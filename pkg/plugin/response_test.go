package plugin

import (
	"bytes"
	"fmt"
	"io"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/valyala/fastjson"
)

func Test_parseStreamResponse(t *testing.T) {
	tests := []struct {
		name     string
		response string
		want     func() backend.DataResponse
	}{
		{
			name:     "empty response",
			response: "",
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
			response: "abcd",
			want: func() backend.DataResponse {
				return newResponseError(fmt.Errorf("error decode response: cannot parse JSON: cannot parse number: unexpected char: \"a\"; unparsed tail: \"abcd\""), backend.StatusInternal)
			},
		},
		{
			name:     "incorrect time in the response",
			response: `{"_time":"acdf"}`,
			want: func() backend.DataResponse {
				return newResponseError(fmt.Errorf("error parse time from _time field: cannot parse acdf: cannot parse duration \"acdf\""), backend.StatusInternal)
			},
		},
		{
			name:     "invalid stream in the response",
			response: `{"_time":"2024-02-20", "_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=}"}`,
			want: func() backend.DataResponse {
				return newResponseError(fmt.Errorf("StringExpr: unexpected token \"}\"; want \"string\"; unparsed data: \"}\""), backend.StatusInternal)
			},
		},
		{
			name:     "correct response line",
			response: `{"_msg":"123","_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}","_time":"2024-02-20T14:04:27Z"}`,
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
			response: `{"_msg":"123","_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}","_time":"2024-02-20T14:04:27Z", "job": "vlogs"}`,
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
			name: "response with different labels and without standard fields",
			response: `{"stream":"stderr","count(*)":"394"}
{"stream":"stdout","count(*)":"21"}`,
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
			response: `{"level":""}`,
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
			name: "response when one stream field is defined and other is free fields",
			response: `{"_time":"2024-06-26T13:00:00Z","logs":"1400"}
{"_time":"2024-06-26T14:00:00Z","logs":"374"}`,
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
			response: `{"_time":"2024-06-26T13:15:15.000Z","_stream_id":"00000000000000009eaf29866f70976a098adc735393deb1","_stream":"{compose_project=\"app\",compose_service=\"gateway\"}","_msg":"\x1b[2m2024-06-26T13:15:15.004Z\x1b[0;39m \x1b[32mTRACE\x1b[0;39m \x1b[35m1\x1b[0;39m \x1b[2m---\x1b[0;39m \x1b[2m[    parallel-19]\x1b[0;39m \x1b[36mo.s.c.g.f.WeightCalculatorWebFilter     \x1b[0;39m \x1b[2m:\x1b[0;39m Weights attr: {} ","compose_project":"app","compose_service":"gateway"}`,
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
			response: `{"_time":"2024-06-26T13:20:34.000Z","_stream":"{compose_project=\"app\",compose_service=\"gateway\"}","_msg":"\u001b[2m2024-06-26T13:20:34.608Z\u001b[0;39m \u001b[33m WARN\u001b[0;39m \u001b[35m1\u001b[0;39m \u001b[2m---\u001b[0;39m \u001b[2m[           main]\u001b[0;39m \u001b[36mjakarta.persistence.spi                 \u001b[0;39m \u001b[2m:\u001b[0;39m jakarta.persistence.spi::No valid providers found. ","compose_project":"app","compose_service":"gateway"}`,
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
			response: `{"count":"507","_msg":"507"}`,
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
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := io.NopCloser(bytes.NewBuffer([]byte(tt.response)))
			w := tt.want()
			resp := parseStreamResponse(r)
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
