package plugin

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/valyala/fastjson"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
)

// idSeparator delimits the fields hashed into a log id so that values can't
// run together across field boundaries (e.g. "ab"+"cd" vs "a"+"bcd").
var idSeparator = []byte{0}

// buildLogID returns a stable identifier for a log row, used by Grafana's
// Logs panel to enable per-row permalinks ("Copy shortlink").
func buildLogID(ts, msg, streamId []byte) string {
	h := fnv.New64a()
	_, _ = h.Write(ts)
	_, _ = h.Write(idSeparator)
	_, _ = h.Write(msg)
	_, _ = h.Write(idSeparator)
	_, _ = h.Write(streamId)
	return strconv.FormatUint(h.Sum64(), 16)
}

// streamFieldsToMap turns the parsed `_stream` fields into a label->value map
// for meta.custom.streams, consumed by the "Show context" stream label selector
func streamFieldsToMap(stf []utils.StreamField) map[string]string {
	m := make(map[string]string, len(stf))
	for _, f := range stf {
		m[f.Label] = f.Value
	}
	return m
}

type logRow struct {
	Time     time.Time
	Line     string
	ID       string
	Labels   json.RawMessage
	StreamID string
	Stream   map[string]string
}

type logFrame struct {
	dataFrame *data.Frame
	streamIds []string
	streams   []map[string]string
}

// append adds a row to the frame
func (b *logFrame) append(r logRow) {
	// order of fields must match the order of fields in the frame
	b.dataFrame.AppendRow(r.Time, r.Line, r.ID, r.Labels)
	b.streamIds = append(b.streamIds, r.StreamID)
	b.streams = append(b.streams, r.Stream)
}

// newLogFrame creates a new frame with the necessary fields
func newLogFrame() *logFrame {
	labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
	labelsField.Name = gLabelsField

	timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFd.Name = gTimeField

	lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	lineField.Name = gLineField

	idField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	idField.Name = gIDField

	return &logFrame{
		dataFrame: data.NewFrame("", timeFd, lineField, idField, labelsField),
		streams:   make([]map[string]string, 0),
		streamIds: make([]string, 0),
	}
}

// parseJsonLine trims, decodes and validates that the line is a JSON object.
func parseJsonLine(parser *fastjson.Parser, b []byte) (*fastjson.Value, error) {
	b = bytes.Trim(b, "\n")
	value, err := parser.ParseBytes(b)
	if err != nil {
		return nil, fmt.Errorf("error decode response: %s", err)
	}
	if value.Type() != fastjson.TypeObject {
		return nil, fmt.Errorf("error get object from decoded response: value doesn't contain object; it contains %s", value.Type())
	}
	return value, nil
}

// getLogRow processes one parsed log object
func getLogRow(value *fastjson.Value) (logRow, error) {
	// Time field
	var ts time.Time
	rawTime := value.GetStringBytes(timeField)
	if rawTime != nil {
		t, err := utils.GetTime(string(rawTime))
		if err != nil {
			return logRow{}, fmt.Errorf("error parse time from _time field: %s", err)
		}
		ts = t
	} else {
		// No `_time` in the row: fall back to the zero time on purpose. Do NOT substitute
		// nowFunc()/time.Now() here — a current timestamp looks plausible and would silently
		// mislead the user into trusting a fabricated time. The zero time is an obvious signal
		// that the timestamp is missing. In practice `_time` is always present for log queries.
		ts = time.Time{}
	}

	rawStreamID := value.GetStringBytes(streamIdField)

	// custom.metadata stream field
	// parse `_stream` into a per-row label map for the log context UI and
	var streamMap map[string]string
	if value.Exists(streamField) {
		rawStream := string(value.GetStringBytes(streamField))
		stf, err := utils.ParseStreamFields(rawStream)
		if err != nil {
			return logRow{}, fmt.Errorf("error parse _stream field: %s", err)
		}
		streamMap = streamFieldsToMap(stf)
	}

	value.Del(timeField)

	// Line field
	rawMsg := value.GetStringBytes(messageField)
	line := string(rawMsg)
	value.Del(messageField)

	// Labels field
	labels := json.RawMessage(value.MarshalTo(nil))
	// ID field
	id := buildLogID(rawTime, rawMsg, rawStreamID)

	return logRow{
		Time:     ts,
		Line:     line,
		Labels:   labels,
		StreamID: string(rawStreamID),
		Stream:   streamMap,
		ID:       id,
	}, nil
}

// parseInstantResponse reads data from the reader and collects
// fields and frame with necessary information
func parseInstantResponse(reader io.Reader) backend.DataResponse {
	frame := newLogFrame()
	br := bufio.NewReaderSize(reader, 64*1024)
	var parser fastjson.Parser
	var finishedReading bool
	for n := 0; !finishedReading; n++ {
		b, err := br.ReadBytes('\n')
		if err != nil {
			if errors.Is(err, bufio.ErrBufferFull) {
				backend.Logger.Debug("skipping line number: line too long", "lineNumber", n)
				continue
			}
			if errors.Is(err, io.EOF) {
				// b can be != nil when EOF is returned, so we need to process it
				finishedReading = true
			} else {
				return newResponseError(fmt.Errorf("cannot read line in response: %s", err), backend.StatusInternal)
			}
		}

		if len(b) == 0 {
			continue
		}

		value, err := parseJsonLine(&parser, b)
		if err != nil {
			return newResponseError(err, backend.StatusInternal)
		}

		row, err := getLogRow(value)
		if err != nil {
			return newResponseError(err, backend.StatusInternal)
		}

		frame.append(row)
	}

	rsp := backend.DataResponse{}
	frame.dataFrame.Meta = &data.FrameMeta{
		PreferredVisualization: logsVisualisation,
		Custom: map[string]any{
			"streamIds": frame.streamIds,
			"streams":   frame.streams,
		},
	}
	rsp.Frames = append(rsp.Frames, frame.dataFrame)

	return rsp
}

// parseStreamResponse reads data from the reader and collects
// fields and frame with necessary information
// it looks like the parseInstantResponse function, but it reads data and continuously
// parse the lines from the reader and we need to collect only one data.Frame
func parseStreamResponse(reader io.Reader, ch chan *data.Frame) error {
	br := bufio.NewReaderSize(reader, 64*1024)
	var parser fastjson.Parser
	var finishedReading bool
	for n := 0; !finishedReading; n++ {
		frame := newLogFrame()

		b, err := br.ReadBytes('\n')
		if err != nil {
			if errors.Is(err, bufio.ErrBufferFull) {
				backend.Logger.Debug("skipping line number: line too long", "lineNumber", n)
				continue
			}
			if errors.Is(err, io.EOF) {
				// b can be != nil when EOF is returned, so we need to process it
				finishedReading = true
			} else {
				return fmt.Errorf("cannot read line in response: %s", err)
			}
		}

		if len(b) == 0 {
			continue
		}

		value, err := parseJsonLine(&parser, b)
		if err != nil {
			return err
		}

		row, err := getLogRow(value)
		if err != nil {
			return err
		}

		frame.append(row)
		// this is necessary information because the logs visualization is preferred
		frame.dataFrame.Meta = &data.FrameMeta{
			PreferredVisualization: logsVisualisation,
			Custom: map[string]any{
				"streamIds": frame.streamIds,
				"streams":   frame.streams,
			},
		}

		ch <- frame.dataFrame
	}

	return nil
}
