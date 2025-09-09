package plugin

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"time"

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
	gValueField  = "Value"

	logsVisualisation = "logs"
)

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

	br := bufio.NewReaderSize(reader, 64*1024)
	var parser fastjson.Parser
	var finishedReading bool
	for n := 0; !finishedReading; n++ {
		b, err := br.ReadBytes('\n')
		if err != nil {
			if errors.Is(err, bufio.ErrBufferFull) {
				backend.Logger.Debug("skipping line number #%d: line too long", n)
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
			stf, err := utils.ParseStreamFields(string(stream))
			if err != nil {
				return newResponseError(fmt.Errorf("%s", err), backend.StatusInternal)
			}
			for _, field := range stf {
				labels[field.Label] = field.Value
			}
			if !value.Exists(messageField) && len(stf) > 0 {
				lineField.Append("")
			}
			if !value.Exists(timeField) && !value.Exists(messageField) && len(stf) == 0 {
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

	frame := data.NewFrame("", timeFd, lineField, labelsField)

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

		b, err := br.ReadBytes('\n')
		if err != nil {
			if errors.Is(err, bufio.ErrBufferFull) {
				backend.Logger.Debug("skipping line number #%d: line too long", n)
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

		if value.Exists(messageField) {
			message := value.GetStringBytes(messageField)
			lineField.Append(string(message))
		}
		if value.Exists(timeField) {
			t := value.GetStringBytes(timeField)
			getTime, err := utils.GetTime(string(t))
			if err != nil {
				return fmt.Errorf("error parse time from _time field: %s", err)
			}
			timeFd.Append(getTime)
		}

		labels := data.Labels{}
		if value.Exists(streamField) {
			stream := value.GetStringBytes(streamField)
			stf, err := utils.ParseStreamFields(string(stream))
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

		frame := data.NewFrame("", timeFd, lineField, labelsField)
		// this is necessary information because the logs visualization is preferred
		frame.Meta = &data.FrameMeta{PreferredVisualization: logsVisualisation}

		ch <- frame
	}

	return nil
}

func parseStatsResponse(reader io.Reader, q *Query) backend.DataResponse {
	var rs Response
	if err := json.NewDecoder(reader).Decode(&rs); err != nil {
		err = fmt.Errorf("failed to decode body response: %w", err)
		return newResponseError(err, backend.StatusInternal)
	}
	rs.ForAlerting = q.ForAlerting

	frames, err := rs.getDataFrames()
	if err != nil {
		err = fmt.Errorf("failed to prepare data from response: %w", err)
		return newResponseError(err, backend.StatusInternal)
	}

	for i := range frames {
		q.addMetadataToMultiFrame(frames[i])
		q.addIntervalToFrame(frames[i])
	}

	return backend.DataResponse{Frames: frames}
}

func parseHitsResponse(reader io.Reader) backend.DataResponse {
	var hr HitsResponse
	if err := json.NewDecoder(reader).Decode(&hr); err != nil {
		err = fmt.Errorf("failed to decode body response: %w", err)
		return newResponseError(err, backend.StatusInternal)
	}

	frames, err := hr.getDataFrames()
	if err != nil {
		err = fmt.Errorf("failed to prepare data from response: %w", err)
		return newResponseError(err, backend.StatusInternal)
	}

	return backend.DataResponse{Frames: frames}
}

// parseErrorResponse reads data from the reader and returns error
func parseErrorResponse(reader io.Reader) error {
	var rs Response
	if err := json.NewDecoder(reader).Decode(&rs); err != nil {
		err = fmt.Errorf("failed to decode body response: %w", err)
		return err
	}

	if rs.Status == "error" {
		return fmt.Errorf("error: %s", rs.Error)
	}

	if rs.Error == "" {
		return fmt.Errorf("got unexpected error from the datasource")
	}

	return nil
}

// parseStringResponseError reads data from the reader and returns error
func parseStringResponseError(reader io.Reader) error {
	d, err := io.ReadAll(reader)
	if err != nil {
		return fmt.Errorf("failed to read body response: %w", err)
	}
	if len(d) == 0 {
		return fmt.Errorf("got empty response from the datasource")
	}
	return fmt.Errorf("error from datasource: %s", string(d))
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

const (
	vector, matrix = "vector", "matrix"
)

// Result represents timeseries from query
type Result struct {
	Labels Labels  `json:"metric"`
	Values []Value `json:"values"`
	Value  Value   `json:"value"`
}

// Value represents timestamp and value of the timeseries
type Value [2]interface{}

// Labels represents timeseries labels
type Labels map[string]string

// Data contains fields
// ResultType which defines type of the query response
// Result resents json of the query response
type Data struct {
	ResultType string          `json:"resultType"`
	Result     json.RawMessage `json:"result"`
}

// Response contains fields from query response
type Response struct {
	Status      string `json:"status"`
	Data        Data   `json:"data"`
	Error       string `json:"error"`
	ForAlerting bool   `json:"-"`
}

// logStats represents response result from the
// stats endpoints of the VictoriaLogs
type logStats struct {
	Result []Result `json:"result"`
}

func (ls logStats) vectorDataFrames() (data.Frames, error) {
	frames := make(data.Frames, len(ls.Result))
	for i, res := range ls.Result {
		value := res.Value

		ts, err := getTimestamp(value)
		if err != nil {
			return nil, fmt.Errorf("metric %v, error to get timestamp for vector response from the stats API: %w", res, err)
		}

		valuePtr, err := getFloatPtr(value)
		if err != nil {
			return nil, fmt.Errorf("metric %v, error to get float value for vector response from the stats API: %w", res, err)
		}

		frames[i] = data.NewFrame("",
			data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{ts}),
			data.NewField(data.TimeSeriesValueFieldName, data.Labels(res.Labels), []*float64{valuePtr}))
	}

	return frames, nil
}

func (ls logStats) alertingDataFrames() (data.Frames, error) {
	frames := make(data.Frames, len(ls.Result))
	for i, res := range ls.Result {
		f, err := strconv.ParseFloat(res.Value[1].(string), 64)
		if err != nil {
			return nil, fmt.Errorf("metric %v, unable to parse timestamp to float64 from %s: %w", res, res.Value[1], err)
		}

		frames[i] = data.NewFrame("",
			data.NewField(data.TimeSeriesValueFieldName, data.Labels(res.Labels), []float64{f})).
			// to show instant alert response with the table we need to define the type of the frame
			// and it should be [0, 1] like it set in the Grafana
			SetMeta(&data.FrameMeta{
				Type:        data.FrameTypeNumericMulti,
				TypeVersion: data.FrameTypeVersion{0, 1},
			})
	}

	return frames, nil
}

func (ls logStats) matrixDataFrames() (data.Frames, error) {
	frames := make(data.Frames, len(ls.Result))
	for i, res := range ls.Result {
		timestamps := make([]time.Time, len(res.Values))
		values := make([]*float64, len(res.Values))

		for j, value := range res.Values {
			t, err := getTimestamp(value)
			if err != nil {
				return nil, fmt.Errorf("metrics %v, error to get timestamp for matrix response from the stats API: %w", res, err)
			}
			timestamps[j] = t

			fPtr, err := getFloatPtr(value)
			if err != nil {
				return nil, fmt.Errorf("metrics %v, error to get float value for matrix response from the stats API: %w", res, err)
			}
			values[j] = fPtr
		}

		if len(values) < 1 || len(timestamps) < 1 {
			return nil, fmt.Errorf("log %v contains no values", res)
		}

		frames[i] = data.NewFrame("",
			data.NewField(data.TimeSeriesTimeFieldName, nil, timestamps),
			data.NewField(data.TimeSeriesValueFieldName, data.Labels(res.Labels), values))
	}

	return frames, nil
}

func (r *Response) getDataFrames() (data.Frames, error) {
	var ls logStats
	if err := json.Unmarshal(r.Data.Result, &ls.Result); err != nil {
		return nil, fmt.Errorf("unmarshal err %s; \n %#v", err, string(r.Data.Result))
	}

	switch r.Data.ResultType {
	case vector:
		if r.ForAlerting {
			return ls.alertingDataFrames()
		}
		return ls.vectorDataFrames()
	case matrix:
		return ls.matrixDataFrames()
	default:
		return nil, fmt.Errorf("unknown result type %q", r.Data.ResultType)
	}
}

// Hit represents a single hit from the query
type Hit struct {
	Fields     map[string]string `json:"fields"`
	Timestamps []string          `json:"timestamps"`
	Values     []float64         `json:"values"`
	Total      int               `json:"total"`
}

// HitsResponse represents response from the hits query
type HitsResponse struct {
	Hits []Hit `json:"hits"`
}

func (hr *HitsResponse) getDataFrames() (data.Frames, error) {
	frames := make(data.Frames, len(hr.Hits))
	for i, hit := range hr.Hits {
		if len(hit.Timestamps) != len(hit.Values) {
			return nil, fmt.Errorf("timestamps and values length mismatch: %d != %d", len(hit.Timestamps), len(hit.Values))
		}

		timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, len(hit.Timestamps))
		timeFd.Name = gTimeField

		valueFd := data.NewFieldFromFieldType(data.FieldTypeFloat64, len(hit.Values))
		valueFd.Name = gValueField
		valueFd.Labels = make(data.Labels)

		for j, ts := range hit.Timestamps {
			getTime, err := utils.GetTime(ts)
			if err != nil {
				return nil, fmt.Errorf("error parse time from _time field: %s", err)
			}
			timeFd.Set(j, getTime)
		}

		for k, v := range hit.Values {
			valueFd.Set(k, v)
		}

		for key, value := range hit.Fields {
			valueFd.Labels[key] = value
			d, err := labelsToJSON(valueFd.Labels)
			if err != nil {
				return nil, fmt.Errorf("error convert labels to json: %s", err)
			}
			valueFd.Config = &data.FieldConfig{DisplayNameFromDS: string(d)}
		}

		frames[i] = data.NewFrame("", timeFd, valueFd)
	}

	return frames, nil
}

func getTimestamp(value Value) (time.Time, error) {
	v, ok := value[0].(float64)
	if !ok {
		return time.Time{}, fmt.Errorf("value: %v unable to parse timestamp to float64 from %s", value, value[0])
	}

	seconds := int64(v)                                // get only seconds
	nanoseconds := int64((v - float64(seconds)) * 1e9) // get only nanoseconds
	t := time.Unix(seconds, nanoseconds)
	return t, nil
}

func getFloatPtr(value Value) (*float64, error) {
	f, ok := value[1].(string)
	if !ok {
		return nil, fmt.Errorf("value: %v unable to convert log value to string from %s", value, value[1])
	}

	var floatPtr *float64
	if f == "" {
		floatPtr = nil
	} else {
		flVal, err := strconv.ParseFloat(f, 64)
		if err != nil {
			return nil, fmt.Errorf("value: %v unable to parse log value to float64 from %s: %w", value, value[1], err)
		}
		floatPtr = utils.Ptr(flVal)
	}
	return floatPtr, nil
}
