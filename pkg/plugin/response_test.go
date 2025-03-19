package plugin

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/valyala/fastjson"
)

func Test_parseStreamResponse(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		want     func() backend.DataResponse
	}{
		{
			name:     "empty response",
			filename: "test-data/empty",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "incorrect response",
			filename: "test-data/incorrect_response",
			want: func() backend.DataResponse {
				return newResponseError(fmt.Errorf("error decode response: cannot parse JSON: cannot parse number: unexpected char: \"a\"; unparsed tail: \"abcd\""), backend.StatusInternal)
			},
		},
		{
			name:     "incorrect time in the response",
			filename: "test-data/incorrect_time",
			want: func() backend.DataResponse {
				return newResponseError(fmt.Errorf("error parse time from _time field: cannot parse acdf: cannot parse duration \"acdf\""), backend.StatusInternal)
			},
		},
		{
			name:     "invalid stream in the response",
			filename: "test-data/invalid_stream",
			want: func() backend.DataResponse {
				return newResponseError(fmt.Errorf("incorrect label value pair \"hostname\" in _stream field must have label=\"value\" format"), backend.StatusInternal)
			},
		},
		{
			name:     "correct response line",
			filename: "test-data/correct_response",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				timeFd.Append(time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC))

				lineField.Append("123")

				labels := data.Labels{
					"application": "logs-benchmark-Apache.log-1708437847",
					"hostname":    "e28a622d7792",
				}

				b, _ := labelsToJSON(labels)

				labelsField.Append(b)
				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "response with different labels",
			filename: "test-data/different_labels",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				timeFd.Append(time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC))

				lineField.Append("123")

				labels := data.Labels{
					"application": "logs-benchmark-Apache.log-1708437847",
					"hostname":    "e28a622d7792",
					"job":         "vlogs",
				}

				b, _ := labelsToJSON(labels)

				labelsField.Append(b)
				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "response with different labels and without standard fields",
			filename: "test-data/no_standard_fields",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				lineField.Append(`{"count(*)":"394","stream":"stderr"}`)
				lineField.Append(`{"count(*)":"21","stream":"stdout"}`)

				labels := data.Labels{
					"count(*)": "394",
					"stream":   "stderr",
				}

				b, _ := labelsToJSON(labels)
				labelsField.Append(b)

				labels = data.Labels{
					"count(*)": "21",
					"stream":   "stdout",
				}
				b, _ = labelsToJSON(labels)
				labelsField.Append(b)
				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "response with different labels only one label",
			filename: "test-data/only_one_label",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				lineField.Append(`{"level":""}`)

				labels := data.Labels{
					"level": "",
				}

				b, _ := labelsToJSON(labels)
				labelsField.Append(b)

				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "response when one stream field is defined and other is free fields",
			filename: "test-data/stream_and_free_field",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				timeFd.Append(time.Date(2024, 06, 26, 13, 00, 00, 0, time.UTC))
				timeFd.Append(time.Date(2024, 06, 26, 14, 00, 00, 0, time.UTC))

				lineField.Append(`{"logs":"1400"}`)
				lineField.Append(`{"logs":"374"}`)

				labels := data.Labels{
					"logs": "1400",
				}

				b, _ := labelsToJSON(labels)
				labelsField.Append(b)

				labels = data.Labels{
					"logs": "374",
				}

				b, _ = labelsToJSON(labels)
				labelsField.Append(b)

				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "response has ANSI chars",
			filename: "test-data/ANSI_chars",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				timeFd.Append(time.Date(2024, 06, 26, 13, 15, 15, 0, time.UTC))

				lineField.Append(`\x1b[2m2024-06-26T13:15:15.004Z\x1b[0;39m \x1b[32mTRACE\x1b[0;39m \x1b[35m1\x1b[0;39m \x1b[2m---\x1b[0;39m \x1b[2m[    parallel-19]\x1b[0;39m \x1b[36mo.s.c.g.f.WeightCalculatorWebFilter     \x1b[0;39m \x1b[2m:\x1b[0;39m Weights attr: {} `)

				labels := data.Labels{
					"compose_project": "app",
					"compose_service": "gateway",
					"_stream_id":      "00000000000000009eaf29866f70976a098adc735393deb1",
				}

				b, _ := labelsToJSON(labels)
				labelsField.Append(b)

				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "response has unicode",
			filename: "test-data/unicode_present",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				timeFd.Append(time.Date(2024, 06, 26, 13, 20, 34, 0, time.UTC))

				value, err := fastjson.Parse(`{"_msg":"\u001b[2m2024-06-26T13:20:34.608Z\u001b[0;39m \u001b[33m WARN\u001b[0;39m \u001b[35m1\u001b[0;39m \u001b[2m---\u001b[0;39m \u001b[2m[           main]\u001b[0;39m \u001b[36mjakarta.persistence.spi                 \u001b[0;39m \u001b[2m:\u001b[0;39m jakarta.persistence.spi::No valid providers found. "}`)
				if err != nil {
					t.Fatalf("error decode response: %s", err)
				}

				if value.Exists(messageField) {
					message := value.GetStringBytes(messageField)
					lineField.Append(string(message))
				}

				labels := data.Labels{
					"compose_project": "app",
					"compose_service": "gateway",
				}

				b, _ := labelsToJSON(labels)
				labelsField.Append(b)

				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "response has labels and message, time field is empty",
			filename: "test-data/time_field_empty",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				lineField.Append("507")

				labels := data.Labels{
					"count": "507",
				}

				b, _ := labelsToJSON(labels)
				labelsField.Append(b)

				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "double labels",
			filename: "test-data/double_labels",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				timeFd.Append(time.Date(2024, 9, 10, 12, 24, 38, 124000000, time.UTC))
				timeFd.Append(time.Date(2024, 9, 10, 12, 36, 10, 664000000, time.UTC))
				timeFd.Append(time.Date(2024, 9, 10, 13, 06, 56, 451000000, time.UTC))

				lineField.Append("1")

				labels := data.Labels{
					"_stream_id": "00000000000000002e3bd2bdc376279a6418761ca20c417c",
					"path":       "/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log",
					"stream":     "stderr",
					"time":       "2024-09-10T12:24:38.124811792Z",
				}

				b, _ := labelsToJSON(labels)
				labelsField.Append(b)

				lineField.Append("2")

				labels = data.Labels{
					"_stream_id": "0000000000000000356bfe9e3c71128c750d94c15df6b908",
					"date":       "0",
					"stream":     "stream1",
					"log.level":  "info",
				}

				b, _ = labelsToJSON(labels)
				labelsField.Append(b)

				lineField.Append("3")

				labels = data.Labels{
					"_stream_id": "00000000000000002e3bd2bdc376279a6418761ca20c417c",
					"path":       "/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log",
					"stream":     "stderr",
					"time":       "2024-09-10T13:06:56.451470093Z",
				}

				b, _ = labelsToJSON(labels)
				labelsField.Append(b)

				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "large response more than 1MB",
			filename: "test-data/large_msg_response_2MB",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				timeFd.Append(time.Date(2024, 9, 10, 12, 36, 10, 664000000, time.UTC))

				// string with more than 1MB
				str := strings.Repeat("1", 1024*1024*2)

				lineField.Append(str)

				labels := data.Labels{
					"_stream_id": "0000000000000000356bfe9e3c71128c750d94c15df6b908",
					"date":       "0",
					"stream":     "stream1",
					"log.level":  "info",
				}

				b, _ := labelsToJSON(labels)
				labelsField.Append(b)

				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
		{
			name:     "response with empty stream fields includes '/' in the label names",
			filename: "test-data/stream_fields_with_slashes_names",
			want: func() backend.DataResponse {
				labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
				labelsField.Name = gLabelsField

				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField

				lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
				lineField.Name = gLineField

				timeFd.Append(time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC))

				lineField.Append("123")

				labels := data.Labels{
					"kubernetes.host": "host1",
					"kubernetes.labels.app.kubernetes.io/instance": "123",
					"kubernetes.labels.app.kubernetes.io/name":     "vmagent",
					"kubernetes.namespace_name":                    "monitoring",
				}

				b, _ := labelsToJSON(labels)

				labelsField.Append(b)
				frame := data.NewFrame("", timeFd, lineField, labelsField)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			file, err := os.ReadFile(tt.filename)
			if err != nil {
				t.Fatalf("error reading file: %s", err)
			}

			r := io.NopCloser(bytes.NewBuffer(file))
			w := tt.want()
			resp := parseInstantResponse(r)

			if w.Error != nil {
				if !reflect.DeepEqual(w, resp) {
					t.Errorf("parseStreamResponse() = %#v, want %#v", resp, w)
				}
				return
			}

			if len(resp.Frames) != 1 {
				t.Fatalf("expected for response to always contain 1 Frame; got %d", len(resp.Frames))
			}

			got := resp.Frames[0]
			want := w.Frames[0]
			expFieldsLen := got.Fields[0].Len()
			for j, field := range want.Fields {
				// if time field is empty, fill it with the value from the response
				// because time field in the parseStreamResponse generated as time.Now()
				if field.Name == gTimeField && field.Len() == 0 {
					for _, f := range got.Fields {
						if f.Name == gTimeField {
							want.Fields[j] = f
						}
					}
				}

				// all fields within response should have equal length
				gf := got.Fields[j]
				if gf.Len() != expFieldsLen {
					t.Fatalf("expected all fields to have equal length %d; got %d instead for field %q",
						expFieldsLen, gf.Len(), gf.Name)
				}
			}

			if !reflect.DeepEqual(got, want) {
				t.Errorf("parseStreamResponse() = %#v, want %#v", got, want)
			}
		})
	}
}

func Test_getStatsResponse(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		q        *Query
		want     func() backend.DataResponse
	}{
		{
			name:     "empty response",
			filename: "test-data/stats_empty",
			want: func() backend.DataResponse {

				frame := data.NewFrame("", nil)

				rsp := backend.DataResponse{}
				frame.Meta = &data.FrameMeta{}
				rsp.Frames = append(rsp.Frames, frame)

				return rsp
			},
			q: &Query{},
		},
		{
			name:     "incorrect response",
			filename: "test-data/stats_incorrect_response",
			want: func() backend.DataResponse {
				return newResponseError(fmt.Errorf("failed to prepare data from response: unmarshal err json: cannot unmarshal string into Go value of type []plugin.Result; \n \"\\\"abc\\\"\""), backend.StatusInternal)
			},
			q: &Query{},
		},
		{
			name:     "correct stats response",
			filename: "test-data/stats_response",
			q: &Query{
				DataQuery: backend.DataQuery{
					RefID: "A",
				},
				LegendFormat: "legend {{app}}",
			},
			want: func() backend.DataResponse {
				frames := []*data.Frame{
					data.NewFrame("legend ",
						data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1730937600, 0)}),
						data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": "message"}, []float64{13377}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
					),
					data.NewFrame("legend ",
						data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1730937600, 0)}),
						data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": ""}, []float64{2078793288}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
					),
				}

				rsp := backend.DataResponse{}
				rsp.Frames = append(rsp.Frames, frames...)
				return rsp
			},
		},
		{
			name:     "correct range response",
			filename: "test-data/stats_range_response",
			q: &Query{
				DataQuery: backend.DataQuery{
					RefID: "A",
				},
				LegendFormat: "legend {{app}}",
			},
			want: func() backend.DataResponse {
				frames := []*data.Frame{
					data.NewFrame("legend ",
						data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1704067200, 0), time.Unix(1704088800, 0), time.Unix(1704110400, 0), time.Unix(1704132000, 0)}),
						data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": ""}, []float64{1311461, 1311601, 1310266, 1310875}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
					),
				}

				rsp := backend.DataResponse{}
				rsp.Frames = append(rsp.Frames, frames...)
				return rsp
			},
		},
		{
			name:     "response with milliseconds in timestamps",
			filename: "test-data/stats_response_milliseconds",
			q: &Query{
				DataQuery: backend.DataQuery{
					RefID: "A",
				},
				LegendFormat: "legend {{app}}",
				Step:         "10ms",
			},
			want: func() backend.DataResponse {
				frames := []*data.Frame{
					data.NewFrame("legend ",
						data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{
							time.Unix(1733187134, 0),
							time.Unix(1733187134, 449999809),
						}),
						data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)"}, []float64{58, 1}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
					),
				}
				rsp := backend.DataResponse{}
				rsp.Frames = append(rsp.Frames, frames...)
				return rsp
			},
		},
		{
			name:     "correct stats response for alerting",
			filename: "test-data/stats_response",
			q: &Query{
				DataQuery: backend.DataQuery{
					RefID: "A",
				},
				LegendFormat: "legend {{app}}",
				ForAlerting:  true,
			},
			want: func() backend.DataResponse {
				frames := []*data.Frame{
					data.NewFrame("",
						data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": "message"}, []float64{13377}),
					),
					data.NewFrame("",
						data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": ""}, []float64{2078793288}),
					),
				}

				rsp := backend.DataResponse{}
				rsp.Frames = append(rsp.Frames, frames...)
				return rsp
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			file, err := os.ReadFile(tt.filename)
			if err != nil {
				t.Fatalf("error reading file: %s", err)
			}

			r := io.NopCloser(bytes.NewBuffer(file))
			w := tt.want()
			resp := parseStatsResponse(r, tt.q)

			if w.Error != nil {
				if w.Error.Error() != resp.Error.Error() {
					t.Errorf("parseStreamResponse() = %#v, want %#v", resp, w)
				}
				return
			}

			if len(resp.Frames) != 0 && len(w.Frames) != 0 {
				got, err := resp.MarshalJSON()
				if err != nil {
					t.Fatalf("error marshal response: %s", err)
				}
				want, err := w.MarshalJSON()
				if err != nil {
					t.Fatalf("error marshal want response: %s", err)
				}
				if !bytes.Equal(got, want) {
					t.Fatalf("\n got value: %s, \n want value: %s", got, want)
				}
			}
		})
	}
}

func Test_parseHitsResponse(t *testing.T) {
	tests := []struct {
		name   string
		reader io.Reader
		want   func() backend.DataResponse
	}{
		{
			name:   "empty response",
			reader: bytes.NewBufferString(`{ "hits": [] }`),
			want: func() backend.DataResponse {
				return backend.DataResponse{}
			},
		},
		{
			name:   "single hit response",
			reader: bytes.NewBufferString(`{ "hits": [{ "fields": { "field1": "value1" }, "timestamps": ["2024-01-01T00:00:00Z"], "values": [1.23] }] }`),
			want: func() backend.DataResponse {
				timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd.Name = gTimeField
				timeFd.Append(time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC))

				valueFd := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
				valueFd.Name = gValueField
				valueFd.Append(1.23)
				valueFd.Labels = data.Labels{"field1": "value1"}
				d, _ := labelsToJSON(valueFd.Labels)

				valueFd.Config = &data.FieldConfig{DisplayNameFromDS: string(d)}

				frame := data.NewFrame("", timeFd, valueFd)
				return backend.DataResponse{Frames: data.Frames{frame}}
			},
		},
		{
			name:   "multiple hits response",
			reader: bytes.NewBufferString(`{ "hits": [{ "fields": { "field1": "value1" }, "timestamps": ["2024-01-01T00:00:00Z"], "values": [1.23] }, { "fields": { "field2": "value2" }, "timestamps": ["2024-01-01T01:00:00Z"], "values": [4.56] }] }`),
			want: func() backend.DataResponse {
				timeFd1 := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd1.Name = gTimeField
				timeFd1.Append(time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC))

				valueFd1 := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
				valueFd1.Name = gValueField
				valueFd1.Append(1.23)
				valueFd1.Labels = data.Labels{"field1": "value1"}
				d, _ := labelsToJSON(valueFd1.Labels)

				valueFd1.Config = &data.FieldConfig{DisplayNameFromDS: string(d)}

				frame1 := data.NewFrame("", timeFd1, valueFd1)

				timeFd2 := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
				timeFd2.Name = gTimeField
				timeFd2.Append(time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC))

				valueFd2 := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
				valueFd2.Name = gValueField
				valueFd2.Append(4.56)
				valueFd2.Labels = data.Labels{"field2": "value2"}
				d, _ = labelsToJSON(valueFd2.Labels)

				valueFd2.Config = &data.FieldConfig{DisplayNameFromDS: string(d)}

				frame2 := data.NewFrame("", timeFd2, valueFd2)

				return backend.DataResponse{Frames: data.Frames{frame1, frame2}}
			},
		},
		{
			name:   "error in response",
			reader: bytes.NewBufferString(`{ "hits": [{ "fields": { "field1": "value1" }, "timestamps": ["invalid-time"], "values": [1.23] }] }`),
			want: func() backend.DataResponse {
				return newResponseError(fmt.Errorf("failed to prepare data from response: error parse time from _time field: cannot parse invalid-time: cannot parse duration \"invalid-time\""), backend.StatusInternal)
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			w := tt.want()
			resp := parseHitsResponse(tt.reader)

			if w.Error != nil {
				if w.Error.Error() != resp.Error.Error() {
					t.Errorf("parseStreamResponse() = %#v, want %#v", resp, w)
				}
				return
			}

			if len(resp.Frames) != 0 && len(w.Frames) != 0 {
				got, err := resp.MarshalJSON()
				if err != nil {
					t.Fatalf("error marshal response: %s", err)
				}
				want, err := w.MarshalJSON()
				if err != nil {
					t.Fatalf("error marshal want response: %s", err)
				}
				if !bytes.Equal(got, want) {
					t.Fatalf("\n got value: %s, \n want value: %s", got, want)
				}
			}
		})
	}
}
