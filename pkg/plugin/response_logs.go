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

var nowFunc = time.Now

// streamFieldsToMap turns the parsed `_stream` fields into a label->value map
// for meta.custom.streams, consumed by the "Show context" stream label selector
func streamFieldsToMap(stf []utils.StreamField) map[string]string {
	m := make(map[string]string, len(stf))
	for _, f := range stf {
		m[f.Label] = f.Value
	}
	return m
}

// parseStreamResponse reads data from the reader and collects
// fields and frame with necessary information
func parseInstantResponse(reader io.Reader) backend.DataResponse {

	labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
	labelsField.Name = gLabelsField

	timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFd.Name = gTimeField

	lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	lineField.Name = gLineField

	idField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	idField.Name = gIDField

	// per-row data for the "Show context" stream label selector
	streamIds := make([]string, 0)
	streams := make([]map[string]string, 0)

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

		b = bytes.Trim(b, "\n")
		value, err := parser.ParseBytes(b)
		if err != nil {
			return newResponseError(fmt.Errorf("error decode response: %s", err), backend.StatusInternal)
		}

		if value.Type() != fastjson.TypeObject {
			return newResponseError(fmt.Errorf("error get object from decoded response: value doesn't contain object; it contains %s", value.Type()), backend.StatusInternal)
		}

		var (
			rowMsg      []byte
			rowStreamId []byte
			rowTime     []byte
		)

		if value.Exists(messageField) {
			rowMsg = value.GetStringBytes(messageField)
			lineField.Append(string(rowMsg))
			value.Del(messageField)
		} else {
			// pad lineField on rows without _msg to keep frame fields equal length
			lineField.Append("")
		}

		if value.Exists(timeField) {
			rowTime = value.GetStringBytes(timeField)
			getTime, err := utils.GetTime(string(rowTime))
			if err != nil {
				return newResponseError(fmt.Errorf("error parse time from _time field: %s", err), backend.StatusInternal)
			}
			timeFd.Append(getTime)
			value.Del(timeField)
		}

		if value.Exists(streamIdField) {
			rowStreamId = value.GetStringBytes(streamIdField)
		}

		// parse `_stream` into a per-row label map for the log context UI and
		// drop it from the row so it does not show up among the log labels.
		// A missing `_stream` field yields a nil map (JSON null) so the frontend
		// can tell "field absent" apart from "field empty" and fall back to `_stream_id`
		var streamMap map[string]string
		if value.Exists(streamField) {
			rowStream := string(value.GetStringBytes(streamField))
			value.Del(streamField)
			stf, err := utils.ParseStreamFields(rowStream)
			if err != nil {
				return newResponseError(fmt.Errorf("error parse _stream field: %s", err), backend.StatusInternal)
			}
			streamMap = streamFieldsToMap(stf)
		}
		streamIds = append(streamIds, string(rowStreamId))
		streams = append(streams, streamMap)

		labelsField.Append(json.RawMessage(value.MarshalTo(nil)))
		idField.Append(buildLogID(rowTime, rowMsg, rowStreamId))
	}

	// Grafana expects lineFields to be always non-empty.
	if lineField.Len() == 0 {
		for i := 0; i < labelsField.Len(); i++ {
			label := labelsField.At(i)
			lineField.Append(fmt.Sprintf("%s", label))
		}
	}

	// Grafana expects time field to be always non-empty.
	if timeFd.Len() == 0 {
		now := nowFunc()
		for i := 0; i < lineField.Len(); i++ {
			timeFd.Append(now)
		}
	}

	frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

	rsp := backend.DataResponse{}
	frame.Meta = &data.FrameMeta{
		Custom: map[string]any{
			"streamIds": streamIds,
			"streams":   streams,
		},
	}
	rsp.Frames = append(rsp.Frames, frame)

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
		labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
		labelsField.Name = gLabelsField

		timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
		timeFd.Name = gTimeField

		lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
		lineField.Name = gLineField

		idField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
		idField.Name = gIDField

		// per-row data for the "Show context" stream label selector
		streamIds := make([]string, 0)
		streams := make([]map[string]string, 0)

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

		b = bytes.Trim(b, "\n")
		value, err := parser.ParseBytes(b)
		if err != nil {
			return fmt.Errorf("error decode response: %s", err)
		}
		if value.Type() != fastjson.TypeObject {
			return fmt.Errorf("error get object from decoded response: value doesn't contain object; it contains %s", value.Type())
		}

		var (
			rowMsg      []byte
			rowStreamId []byte
			rowTime     []byte
		)

		if value.Exists(messageField) {
			rowMsg = value.GetStringBytes(messageField)
			lineField.Append(string(rowMsg))
			value.Del(messageField)
		}
		if value.Exists(timeField) {
			rowTime = value.GetStringBytes(timeField)
			getTime, err := utils.GetTime(string(rowTime))
			if err != nil {
				return fmt.Errorf("error parse time from _time field: %s", err)
			}
			timeFd.Append(getTime)
			value.Del(timeField)
		}

		if value.Exists(streamIdField) {
			rowStreamId = value.GetStringBytes(streamIdField)
		}

		// parse `_stream` into a per-row label map for the log context UI and
		// drop it from the row so it does not show up among the log labels.
		// A missing `_stream` field yields a nil map (JSON null) so the frontend
		// can tell "field absent" apart from "field empty" and fall back to `_stream_id`
		var streamMap map[string]string
		if value.Exists(streamField) {
			rowStream := string(value.GetStringBytes(streamField))
			value.Del(streamField)
			stf, err := utils.ParseStreamFields(rowStream)
			if err != nil {
				return fmt.Errorf("error parse _stream field: %s", err)
			}
			streamMap = streamFieldsToMap(stf)
		}
		streamIds = append(streamIds, string(rowStreamId))
		streams = append(streams, streamMap)

		labelsField.Append(json.RawMessage(value.MarshalTo(nil)))
		idField.Append(buildLogID(rowTime, rowMsg, rowStreamId))

		// Grafana expects lineFields to be always non-empty.
		if lineField.Len() == 0 {
			for i := 0; i < labelsField.Len(); i++ {
				label := labelsField.At(i)
				lineField.Append(fmt.Sprintf("%s", label))
			}
		}

		// Grafana expects time field to be always non-empty.
		if timeFd.Len() == 0 {
			now := nowFunc()
			for i := 0; i < lineField.Len(); i++ {
				timeFd.Append(now)
			}
		}

		frame := data.NewFrame("", timeFd, lineField, idField, labelsField)
		// this is necessary information because the logs visualization is preferred
		frame.Meta = &data.FrameMeta{
			PreferredVisualization: logsVisualisation,
			Custom: map[string]any{
				"streamIds": streamIds,
				"streams":   streams,
			},
		}

		ch <- frame
	}

	return nil
}
