package plugin

import (
	"bufio"
	"bytes"
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

// buildLogID returns a stable identifier for a log row, used by Grafana's
// Logs panel to enable per-row permalinks ("Copy shortlink").
func buildLogID(ts time.Time, msg, stream string) string {
	h := fnv.New64a()
	_, _ = h.Write([]byte(strconv.FormatInt(ts.UnixNano(), 10)))
	_, _ = h.Write([]byte{0})
	_, _ = h.Write([]byte(msg))
	_, _ = h.Write([]byte{0})
	_, _ = h.Write([]byte(stream))
	return strconv.FormatUint(h.Sum64(), 16)
}

var nowFunc = time.Now

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

		var (
			rowMsg    string
			rowStream string
			rowTime   time.Time
		)

		if value.Exists(messageField) {
			message := value.GetStringBytes(messageField)
			rowMsg = string(message)
			lineField.Append(rowMsg)
		}
		if value.Exists(timeField) {
			t := value.GetStringBytes(timeField)
			getTime, err := utils.GetTime(string(t))
			if err != nil {
				return newResponseError(fmt.Errorf("error parse time from _time field: %s", err), backend.StatusInternal)
			}
			rowTime = getTime
			timeFd.Append(rowTime)
		}

		labels := data.Labels{}
		if value.Exists(streamField) {
			stream := value.GetStringBytes(streamField)
			rowStream = string(stream)
			stf, err := utils.ParseStreamFields(rowStream)
			if err != nil {
				return newResponseError(fmt.Errorf("%s", err), backend.StatusInternal)
			}
			for _, field := range stf {
				labels[field.Label] = field.Value
			}
			if !value.Exists(messageField) && len(stf) >= 0 {
				lineField.Append("")
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
		idField.Append(buildLogID(rowTime, rowMsg, rowStream))
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
	frame.Meta = &data.FrameMeta{}
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

		var (
			rowMsg    string
			rowStream string
			rowTime   time.Time
		)

		if value.Exists(messageField) {
			message := value.GetStringBytes(messageField)
			rowMsg = string(message)
			lineField.Append(rowMsg)
		}
		if value.Exists(timeField) {
			t := value.GetStringBytes(timeField)
			getTime, err := utils.GetTime(string(t))
			if err != nil {
				return fmt.Errorf("error parse time from _time field: %s", err)
			}
			rowTime = getTime
			timeFd.Append(rowTime)
		}

		labels := data.Labels{}
		if value.Exists(streamField) {
			stream := value.GetStringBytes(streamField)
			rowStream = string(stream)
			stf, err := utils.ParseStreamFields(rowStream)
			if err != nil {
				return err
			}
			for _, field := range stf {
				labels[field.Label] = field.Value
			}
		}

		obj, err := value.Object()
		if err != nil {
			return fmt.Errorf("error get object from decoded response: %s", err)
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
			return err
		}
		labelsField.Append(d)
		idField.Append(buildLogID(rowTime, rowMsg, rowStream))

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
		frame.Meta = &data.FrameMeta{PreferredVisualization: logsVisualisation}

		ch <- frame
	}

	return nil
}
