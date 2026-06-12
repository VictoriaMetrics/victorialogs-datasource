package plugin

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
)

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

// logStats represents response result from the
// stats endpoints of the VictoriaLogs
type logStats struct {
	Result []Result `json:"result"`
}

func (ls logStats) vectorDataFrames() (data.Frames, error) {
	frames := make(data.Frames, len(ls.Result))
	for i, res := range ls.Result {
		value := res.Value

		ts, err := getTimestamp(value[0])
		if err != nil {
			return nil, fmt.Errorf("failed to parse timestamp for metric %v: %w", res, err)
		}

		valuePtr, err := getFloatPtr(value[1])
		if err != nil {
			return nil, fmt.Errorf("failed to parse float value for metric %v: %w", res, err)
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
			t, err := getTimestamp(value[0])
			if err != nil {
				return nil, fmt.Errorf("failed to parse timestamp response for metric %v: %w", res, err)
			}
			timestamps[j] = t

			fPtr, err := getFloatPtr(value[1])
			if err != nil {
				return nil, fmt.Errorf("failed to parse float value response for metric %v: %w", res, err)
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

func getTimestamp(value interface{}) (time.Time, error) {
	v, ok := value.(float64)
	if !ok {
		return time.Time{}, fmt.Errorf("failed to convert timestamp to float64 for value %v", value)
	}

	seconds := int64(v)                                // get only seconds
	nanoseconds := int64((v - float64(seconds)) * 1e9) // get only nanoseconds
	t := time.Unix(seconds, nanoseconds)
	return t, nil
}

func getFloatPtr(value interface{}) (*float64, error) {
	f, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("unable to convert log value to string from %v", value)
	}

	if f == "" {
		return nil, nil
	}

	flVal, err := strconv.ParseFloat(f, 64)
	if err != nil {
		return nil, fmt.Errorf("unable to parse log value to float64 from %v: %w", value, err)
	}

	floatPtr := utils.Ptr(flVal)
	return floatPtr, nil
}
