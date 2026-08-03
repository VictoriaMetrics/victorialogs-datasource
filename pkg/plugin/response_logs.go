package plugin

import (
	"encoding/json"
	"errors"
	"io"
	"time"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// streamFieldsToMap turns the parsed `_stream` fields into a label->value map
// for the hidden `streams` field, consumed by the "Show context" stream label
// selector and the stream-field filter detection
func streamFieldsToMap(stf []utils.StreamField) map[string]string {
	m := make(map[string]string, len(stf))
	for _, f := range stf {
		m[f.Label] = f.Value
	}
	return m
}

// hiddenFieldConfig hides a technical field from the log details, table and
// other Grafana visualizations
func hiddenFieldConfig() *data.FieldConfig {
	return &data.FieldConfig{Custom: map[string]any{"hidden": true}}
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

	streamsField := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)
	streamsField.Name = gStreamsField
	streamsField.Config = hiddenFieldConfig()

	streamIdField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	streamIdField.Name = gStreamIdField
	streamIdField.Config = hiddenFieldConfig()

	frame := data.NewFrame("", timeFd, lineField, idField, labelsField, streamsField, streamIdField)
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: logsVisualisation,
	}

	return &logFrame{
		dataFrame: frame,
	}
}

// append adds a row to the frame
func (b *logFrame) append(r logRow) {
	// order of fields must match the order of fields in the frame
	b.dataFrame.AppendRow(r.Time, r.Line, r.ID, r.Labels, streamToJSON(r.Stream), r.StreamID)
}

// streamToJSON encodes the per-row stream label map for the hidden `streams`
// field; a row without a `_stream` field is kept as null
func streamToJSON(stream map[string]string) *json.RawMessage {
	if stream == nil {
		return nil
	}
	b, _ := json.Marshal(stream)
	return new(json.RawMessage(b))
}

// parseInstantResponse reads data from the reader and collects
// fields and frame with necessary information
func parseInstantResponse(lr *logReader) backend.DataResponse {
	frame := newLogFrame()
	for {
		row, err := lr.ReadRow()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return newResponseError(err, backend.StatusInternal)
		}
		frame.append(row)
	}
	rsp := backend.DataResponse{}
	rsp.Frames = append(rsp.Frames, frame.dataFrame)
	return rsp
}

// parseStreamResponse reads data from the reader and collects
// fields and frame with necessary information
// it looks like the parseInstantResponse function, but it reads data and continuously
// parse the lines from the reader and we need to collect only one data.Frame
func parseStreamResponse(lr *logReader, ch chan *data.Frame) error {
	for {
		row, err := lr.ReadRow()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		frame := newLogFrame()
		frame.append(row)
		ch <- frame.dataFrame
	}
}
