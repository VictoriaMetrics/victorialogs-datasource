package plugin

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/valyala/fastjson"
)

var errLineTooLong = errors.New("line too long")

type logReader struct {
	parser       fastjson.Parser
	idb          *idBuilder
	bufferReader *bufio.Reader
	lineNum      int64
}

func newLogReader(reader io.Reader) *logReader {
	bufferReader := bufio.NewReaderSize(reader, 64*1024)
	return &logReader{
		idb:          newIDBuilder(),
		bufferReader: bufferReader,
	}
}

func (lr *logReader) ReadRow() (logRow, error) {
	for {
		b, err := lr.readLine()
		if errors.Is(err, errLineTooLong) {
			backend.Logger.Debug("skipping line: line too long", "lineNumber", lr.lineNum)
			continue
		}
		if err != nil {
			return logRow{}, err
		}
		if len(bytes.TrimSpace(b)) == 0 {
			continue
		}
		return lr.parseRow(b)
	}
}

func (lr *logReader) readLine() ([]byte, error) {
	lr.lineNum++
	b, err := lr.bufferReader.ReadBytes('\n')
	switch {
	case err == nil:
		return b, nil
	case errors.Is(err, bufio.ErrBufferFull):
		for errors.Is(err, bufio.ErrBufferFull) {
			_, err = lr.bufferReader.ReadBytes('\n')
		}
		if err != nil && !errors.Is(err, io.EOF) {
			return nil, fmt.Errorf("cannot read line in response: %w", err)
		}
		return nil, errLineTooLong
	case errors.Is(err, io.EOF):
		if len(b) > 0 {
			return b, nil
		}
		return nil, io.EOF
	default:
		return nil, fmt.Errorf("cannot read line in response: %w", err)
	}
}

// parseJsonLine trims, decodes and validates that the line is a JSON object.
func (lr *logReader) parseJsonLine(b []byte) (*fastjson.Value, error) {
	b = bytes.Trim(b, "\n")
	value, err := lr.parser.ParseBytes(b)
	if err != nil {
		return nil, fmt.Errorf("error decode response: %s", err)
	}
	if value.Type() != fastjson.TypeObject {
		return nil, fmt.Errorf("error get object from decoded response: value doesn't contain object; it contains %s", value.Type())
	}
	return value, nil
}

// getLogRow processes one parsed log object
func (lr *logReader) getLogRow(value *fastjson.Value) (logRow, error) {
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
	id := lr.idb.buildUniqLogID(rawTime, rawMsg, rawStreamID, labels)

	return logRow{
		Time:     ts,
		Line:     line,
		Labels:   labels,
		StreamID: string(rawStreamID),
		Stream:   streamMap,
		ID:       id,
	}, nil
}

func (lr *logReader) parseRow(data []byte) (logRow, error) {
	value, err := lr.parseJsonLine(data)
	if err != nil {
		return logRow{}, err
	}

	row, err := lr.getLogRow(value)
	if err != nil {
		return logRow{}, err
	}

	return row, nil
}
