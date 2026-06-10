package plugin

import (
	"bytes"
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func Test_parseHitsResponse(t *testing.T) {
	type opts struct {
		reader io.Reader
		want   func() backend.DataResponse
	}
	f := func(opts opts) {
		t.Helper()
		w := opts.want()
		resp := parseHitsResponse(opts.reader)

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
	}

	// empty response
	o := opts{
		reader: bytes.NewBufferString(`{ "hits": [] }`),
		want: func() backend.DataResponse {
			return backend.DataResponse{}
		},
	}
	f(o)

	// single hit response
	o = opts{
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
	}
	f(o)

	// multiple hits response
	o = opts{
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
	}
	f(o)

	// error in response
	o = opts{
		reader: bytes.NewBufferString(`{ "hits": [{ "fields": { "field1": "value1" }, "timestamps": ["invalid-time"], "values": [1.23] }] }`),
		want: func() backend.DataResponse {
			return newResponseError(fmt.Errorf("failed to prepare data from response: error parse time from _time field: cannot parse invalid-time: cannot parse duration \"invalid-time\""), backend.StatusInternal)
		},
	}
	f(o)
}
