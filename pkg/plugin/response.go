package plugin

import (
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/VictoriaMetrics/metricsql"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
)

const (
	// VictoriaLogs field types
	messageField = "_msg"
	streamField  = "_stream"
	timeField    = "_time"

	// Grafana logs fields
	gLabelsField = "labels"
	gTimeField   = "Time"
	gLineField   = "Line"
)

// Response contains fields from query response
// It represents victoria logs response
type Response map[string]string

// parseStreamResponse reads data from the reader and collects
// fields and frame with necessary information
func parseStreamResponse(reader io.Reader) backend.DataResponse {

	labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
	labelsField.Name = gLabelsField

	timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFd.Name = gTimeField

	lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	lineField.Name = gLineField

	labels := data.Labels{}

	dec := json.NewDecoder(reader)

	for dec.More() {
		var r Response
		err := dec.Decode(&r)
		if err != nil {
			return newResponseError(fmt.Errorf("error decode response: %s", err), backend.StatusInternal)
		}

		for fieldName, value := range r {
			switch fieldName {
			case messageField:
				lineField.Append(value)
			case timeField:
				getTime, err := utils.GetTime(value)
				if err != nil {
					return newResponseError(fmt.Errorf("error parse time from _time field: %s", err), backend.StatusInternal)
				}
				timeFd.Append(getTime)
			case streamField:
				expr, err := metricsql.Parse(value)
				if err != nil {
					return newResponseError(err, backend.StatusInternal)
				}
				if mExpr, ok := expr.(*metricsql.MetricExpr); ok {
					for _, filters := range mExpr.LabelFilterss {
						for _, filter := range filters {
							labels[filter.Label] = filter.Value
						}
					}
				}
			default:
				labels[fieldName] = value
			}
		}

		d, err := labelsToJSON(labels)
		if err != nil {
			return newResponseError(err, backend.StatusInternal)
		}
		labelsField.Append(d)

		// some logsql requests can return only labels or fields without _time field
		// in that case we need to fill time field with current time value
		// to avoid empty time field in the response. Please see the test for more details.
		if timeFd.Len() == 0 {
			lineField.Append(string(d))
		}
	}

	if timeFd.Len() == 0 {
		for i := 0; i < lineField.Len(); i++ {
			timeFd.Append(time.Now())
		}
	}

	frame := data.NewFrame("", timeFd, lineField, labelsField)

	rsp := backend.DataResponse{}
	frame.Meta = &data.FrameMeta{}
	rsp.Frames = append(rsp.Frames, frame)

	return rsp
}

// labelsToJSON converts labels to json representation
// data.Labels when converted to JSON keep the fields sorted
func labelsToJSON(labels data.Labels) (json.RawMessage, error) {
	bytes, err := json.Marshal(labels)
	if err != nil {
		return nil, err
	}

	return bytes, nil
}
