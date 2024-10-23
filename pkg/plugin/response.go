package plugin

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/VictoriaMetrics/metricsql"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/valyala/fastjson"

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

// parseStreamResponse reads data from the reader and collects
// fields and frame with necessary information
func parseStreamResponse(reader io.Reader) backend.DataResponse {

	labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
	labelsField.Name = gLabelsField

	timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeFd.Name = gTimeField

	lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	lineField.Name = gLineField

	sc := bufio.NewReader(reader)

	finishedReading := false
	n := -1
	for !finishedReading {
		n++
		b, err := sc.ReadBytes('\n')
		if err != nil {
			if !errors.Is(err, io.EOF) && !errors.Is(err, bufio.ErrBufferFull) {
				return newResponseError(fmt.Errorf("cannot read line in response: %s", err), backend.StatusInternal)
			}
			if errors.Is(err, bufio.ErrBufferFull) {
				// Skip the line if it's too long.
				backend.Logger.Info("skipping line number #%d: line too long", n)
				continue
			}
			finishedReading = true
		}

		if len(b) == 0 {
			continue
		}

		b = bytes.Trim(b, "\n")
		value, err := fastjson.ParseBytes(b)
		if err != nil {
			return newResponseError(fmt.Errorf("error decode response: %s", err), backend.StatusInternal)
		}

		if value.Exists(messageField) {
			message := value.GetStringBytes(messageField)
			lineField.Append(string(message))
		}
		if value.Exists(timeField) {
			t := value.GetStringBytes(timeField)
			getTime, err := utils.GetTime(string(t))
			if err != nil {
				return newResponseError(fmt.Errorf("error parse time from _time field: %s", err), backend.StatusInternal)
			}
			timeFd.Append(getTime)
		}

		labels := data.Labels{}
		if value.Exists(streamField) {
			stream := value.GetStringBytes(streamField)
			expr, err := metricsql.Parse(string(stream))
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
		}

		obj, err := value.Object()
		if err != nil {
			return newResponseError(fmt.Errorf("error get object from decoded response: %s", err), backend.StatusInternal)
		}
		obj.Visit(func(key []byte, v *fastjson.Value) {
			if bytes.Equal(key, []byte(timeField)) ||
				bytes.Equal(key, []byte(streamField)) ||
				bytes.Equal(key, []byte(messageField)) {
				return
			}
			fieldName := string(key)
			value := string(v.GetStringBytes())
			labels[fieldName] = value
		})

		d, err := labelsToJSON(labels)
		if err != nil {
			return newResponseError(err, backend.StatusInternal)
		}
		labelsField.Append(d)
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
		now := time.Now()
		for i := 0; i < lineField.Len(); i++ {
			timeFd.Append(now)
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
	b, err := json.Marshal(labels)
	if err != nil {
		return nil, err
	}

	return b, nil
}
