package plugin

import (
	"bytes"
	"encoding/json"
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

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
)

type row = struct {
	ts       string
	msg      string
	streamID string
	labels   string
}

// newIDField creates an id field pre-populated for the provided rows.
func newIDField(rows ...row) *data.Field {
	f := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	f.Name = gIDField
	for _, r := range rows {
		f.Append(buildLogID([]byte(r.ts), []byte(r.msg), []byte(r.streamID), []byte(r.labels)))
	}
	return f
}

// newHiddenStreamFields builds the hidden per-row `streams`/`streamId` fields
// the same way production log frames carry them
func newHiddenStreamFields(streamIds []string, streams []map[string]string) (*data.Field, *data.Field) {
	streamsField := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)
	streamsField.Name = gStreamsField
	streamsField.Config = hiddenFieldConfig()
	for _, s := range streams {
		streamsField.Append(streamToJSON(s))
	}

	streamIdField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	streamIdField.Name = gStreamIdField
	streamIdField.Config = hiddenFieldConfig()
	for _, id := range streamIds {
		streamIdField.Append(id)
	}

	return streamsField, streamIdField
}

func Test_parseInstantResponse(t *testing.T) {
	// mustTime parses a raw _time string the same way production does.
	getTimeType := func(s string) time.Time {
		tt, err := utils.GetTime(s)
		if err != nil {
			t.Fatalf("error parse time %q: %s", s, err)
		}
		return tt
	}

	// newFrame assembles an expected logs frame from its four fields plus the
	// per-row stream data carried in the hidden `streams`/`streamId` fields.
	newFrame := func(timeFd, lineField, idField, labelsField *data.Field, streamIds []string, streams []map[string]string) backend.DataResponse {
		streamsField, streamIdField := newHiddenStreamFields(streamIds, streams)
		frame := data.NewFrame("", timeFd, lineField, idField, labelsField, streamsField, streamIdField)
		frame.Meta = &data.FrameMeta{
			PreferredVisualization: logsVisualisation,
		}
		return backend.DataResponse{Frames: data.Frames{frame}}
	}

	type opts struct {
		filename string
		want     func() backend.DataResponse
	}
	f := func(opts opts) {
		t.Helper()
		file, err := os.ReadFile(opts.filename)
		if err != nil {
			t.Fatalf("error reading file: %s", err)
		}

		r := io.NopCloser(bytes.NewBuffer(file))
		w := opts.want()
		resp := parseInstantResponse(newLogReader(r))

		if w.Error != nil {
			if !reflect.DeepEqual(w, resp) {
				t.Errorf("parseInstantResponse() = %#v, want %#v", resp, w)
			}
			return
		}

		if len(resp.Frames) != 1 {
			t.Fatalf("expected for response to always contain 1 Frame; got %d", len(resp.Frames))
		}

		got := resp.Frames[0]
		want := w.Frames[0]
		// this marshal operation catch errors like different field numbers
		gb, err := got.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal got frame to JSON: %s", err)
		}
		wb, err := want.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal want frame to JSON: %s", err)
		}

		if !bytes.Equal(gb, wb) {
			t.Errorf("parseInstantResponse():\n got = %s\nwant = %s", gb, wb)
		}
	}

	newField := func(ft data.FieldType, name string) *data.Field {
		fd := data.NewFieldFromFieldType(ft, 0)
		fd.Name = name
		return fd
	}

	// empty response
	o := opts{
		filename: "test-data/empty",
		want: func() backend.DataResponse {
			return newFrame(
				newField(data.FieldTypeTime, gTimeField),
				newField(data.FieldTypeString, gLineField),
				newIDField(),
				newField(data.FieldTypeJSON, gLabelsField),
				[]string{},
				[]map[string]string{},
			)
		},
	}
	f(o)

	// incorrect response
	o = opts{
		filename: "test-data/incorrect_response",
		want: func() backend.DataResponse {
			return newResponseError(fmt.Errorf("error decode response: cannot parse JSON: cannot parse number: unexpected char: \"a\"; unparsed tail: \"abcd\""), backend.StatusInternal)
		},
	}
	f(o)

	// incorrect time in the response
	o = opts{
		filename: "test-data/incorrect_time",
		want: func() backend.DataResponse {
			return newResponseError(fmt.Errorf("error parse time from _time field: cannot parse acdf: cannot parse duration \"acdf\""), backend.StatusInternal)
		},
	}
	f(o)

	// invalid stream in the response: a malformed `_stream` fails the whole response
	o = opts{
		filename: "test-data/invalid_stream",
		want: func() backend.DataResponse {
			return newResponseError(fmt.Errorf("error parse _stream field: _stream field \"hostname=\" must have quoted value"), backend.StatusInternal)
		},
	}
	f(o)

	// empty stream field in the response
	o = opts{
		filename: "test-data/empty_stream",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-02-20"
			timeFd.Append(getTimeType(tsRaw))

			msgRaw := ""
			lineField.Append(msgRaw)
			lblRaw := `{"_stream":"{}"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msgRaw, "", lblRaw}), labelsField, []string{""}, []map[string]string{{}})
		},
	}
	f(o)

	// correct response line
	o = opts{
		filename: "test-data/correct_response",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-02-20T14:04:27Z"
			timeFd.Append(getTimeType(tsRaw))

			msgRaw := "123"
			lineField.Append(msgRaw)
			lblRaw := `{"_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msgRaw, "", lblRaw}), labelsField, []string{""}, []map[string]string{{"application": "logs-benchmark-Apache.log-1708437847", "hostname": "e28a622d7792"}})
		},
	}
	f(o)

	// response with different labels
	o = opts{
		filename: "test-data/different_labels",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-02-20T14:04:27Z"
			timeFd.Append(getTimeType(tsRaw))

			msgRaw := "123"
			lineField.Append(msgRaw)
			lblRaw := `{"_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}","job":"vlogs"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msgRaw, "", lblRaw}), labelsField, []string{""}, []map[string]string{{"application": "logs-benchmark-Apache.log-1708437847", "hostname": "e28a622d7792"}})
		},
	}
	f(o)

	// response with different labels and without standard fields
	o = opts{
		filename: "test-data/no_standard_fields",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			timeFd.Append(time.Time{})
			timeFd.Append(time.Time{})
			lineField.Append("")
			lineField.Append("")
			lbl1 := `{"stream":"stderr","count(*)":"394"}`
			lbl2 := `{"stream":"stdout","count(*)":"21"}`
			labelsField.Append(json.RawMessage(lbl1))
			labelsField.Append(json.RawMessage(lbl2))
			idField := newIDField(
				row{"", "", "", lbl1},
				row{"", "", "", lbl2},
			)

			return newFrame(timeFd, lineField, idField, labelsField, []string{"", ""}, []map[string]string{nil, nil})
		},
	}
	f(o)

	// response with different labels only one label
	o = opts{
		filename: "test-data/only_one_label",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			timeFd.Append(time.Time{})
			lineField.Append("")
			lblRaw := `{"level":""}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{"", "", "", lblRaw}), labelsField, []string{""}, []map[string]string{nil})
		},
	}
	f(o)

	// response when one stream field is defined and other is free fields
	o = opts{
		filename: "test-data/stream_and_free_field",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			ts1 := "2024-06-26T13:00:00Z"
			ts2 := "2024-06-26T14:00:00Z"
			timeFd.Append(getTimeType(ts1))
			timeFd.Append(getTimeType(ts2))
			lineField.Append("")
			lineField.Append("")
			lbl1 := `{"logs":"1400"}`
			lbl2 := `{"logs":"374"}`
			labelsField.Append(json.RawMessage(lbl1))
			labelsField.Append(json.RawMessage(lbl2))

			return newFrame(timeFd, lineField, newIDField(row{ts1, "", "", lbl1}, row{ts2, "", "", lbl2}), labelsField, []string{"", ""}, []map[string]string{nil, nil})
		},
	}
	f(o)

	// response has ANSI chars
	o = opts{
		filename: "test-data/ANSI_chars",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-06-26T13:15:15.000Z"
			streamID := "00000000000000009eaf29866f70976a098adc735393deb1"
			msg := `\x1b[2m2024-06-26T13:15:15.004Z\x1b[0;39m \x1b[32mTRACE\x1b[0;39m \x1b[35m1\x1b[0;39m \x1b[2m---\x1b[0;39m \x1b[2m[    parallel-19]\x1b[0;39m \x1b[36mo.s.c.g.f.WeightCalculatorWebFilter     \x1b[0;39m \x1b[2m:\x1b[0;39m Weights attr: {} `

			timeFd.Append(getTimeType(tsRaw))
			lineField.Append(msg)
			lblRaw := `{"_stream_id":"00000000000000009eaf29866f70976a098adc735393deb1","_stream":"{compose_project=\"app\",compose_service=\"gateway\"}","compose_project":"app","compose_service":"gateway"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msg, streamID, lblRaw}), labelsField, []string{streamID}, []map[string]string{{"compose_project": "app", "compose_service": "gateway"}})
		},
	}
	f(o)

	// response has unicode
	o = opts{
		filename: "test-data/unicode_present",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-06-26T13:20:34.000Z"

			value, err := fastjson.Parse(`{"_msg":"\u001b[2m2024-06-26T13:20:34.608Z\u001b[0;39m \u001b[33m WARN\u001b[0;39m \u001b[35m1\u001b[0;39m \u001b[2m---\u001b[0;39m \u001b[2m[           main]\u001b[0;39m \u001b[36mjakarta.persistence.spi                 \u001b[0;39m \u001b[2m:\u001b[0;39m jakarta.persistence.spi::No valid providers found. "}`)
			if err != nil {
				t.Fatalf("error decode response: %s", err)
			}
			msg := string(value.GetStringBytes(messageField))

			timeFd.Append(getTimeType(tsRaw))
			lineField.Append(msg)
			lblRaw := `{"_stream":"{compose_project=\"app\",compose_service=\"gateway\"}","compose_project":"app","compose_service":"gateway"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msg, "", lblRaw}), labelsField, []string{""}, []map[string]string{{"compose_project": "app", "compose_service": "gateway"}})
		},
	}
	f(o)

	// response has labels and message, time field is empty
	o = opts{
		filename: "test-data/time_field_empty",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			timeFd.Append(time.Time{})
			lineField.Append("507")
			lblRaw := `{"count":"507"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{"", "507", "", lblRaw}), labelsField, []string{""}, []map[string]string{nil})
		},
	}
	f(o)

	// response mixes rows with and without _time
	o = opts{
		filename: "test-data/time_field_missing_in_one_row",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-02-20T14:04:27Z"
			timeFd.Append(getTimeType(tsRaw))
			timeFd.Append(time.Time{})
			lineField.Append("123")
			lineField.Append("456")
			lblRaw := `{"_stream":"{app=\"test\"}"}`
			labelsField.Append(json.RawMessage(lblRaw))
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(
				timeFd,
				lineField,
				newIDField(
					row{tsRaw, "123", "", lblRaw},
					row{"", "456", "", lblRaw},
				),
				labelsField,
				[]string{"", ""},
				[]map[string]string{
					{"app": "test"},
					{"app": "test"},
				},
			)
		},
	}
	f(o)

	// double labels
	o = opts{
		filename: "test-data/double_labels",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			ts1 := "2024-09-10T12:24:38.124811Z"
			ts2 := "2024-09-10T12:36:10.664553169Z"
			ts3 := "2024-09-10T13:06:56.45147Z"
			sid13 := "00000000000000002e3bd2bdc376279a6418761ca20c417c"
			sid2 := "0000000000000000356bfe9e3c71128c750d94c15df6b908"

			timeFd.Append(getTimeType(ts1))
			timeFd.Append(getTimeType(ts2))
			timeFd.Append(getTimeType(ts3))
			lineField.Append("1")
			lineField.Append("2")
			lineField.Append("3")
			lbl1 := `{"_stream_id":"00000000000000002e3bd2bdc376279a6418761ca20c417c","_stream":"{path=\"/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log\",stream=\"stderr\"}","path":"/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log","stream":"stderr","time":"2024-09-10T12:24:38.124811792Z"}`
			lbl2 := `{"_stream_id":"0000000000000000356bfe9e3c71128c750d94c15df6b908","_stream":"{stream=\"stream1\"}","date":"0","stream":"stream1","log.level":"info"}`
			lbl3 := `{"_stream_id":"00000000000000002e3bd2bdc376279a6418761ca20c417c","_stream":"{path=\"/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log\",stream=\"stderr\"}","path":"/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log","stream":"stderr","time":"2024-09-10T13:06:56.451470093Z"}`
			labelsField.Append(json.RawMessage(lbl1))
			labelsField.Append(json.RawMessage(lbl2))
			labelsField.Append(json.RawMessage(lbl3))

			pathValue := "/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log"
			return newFrame(timeFd, lineField, newIDField(
				row{ts1, "1", sid13, lbl1},
				row{ts2, "2", sid2, lbl2},
				row{ts3, "3", sid13, lbl3},
			), labelsField, []string{sid13, sid2, sid13}, []map[string]string{
				{"path": pathValue, "stream": "stderr"},
				{"stream": "stream1"},
				{"path": pathValue, "stream": "stderr"},
			})
		},
	}
	f(o)

	// large response more than 1MB
	o = opts{
		filename: "test-data/large_msg_response_2MB",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-09-10T12:36:10.664553169Z"
			streamID := "0000000000000000356bfe9e3c71128c750d94c15df6b908"
			// string with more than 1MB
			str := strings.Repeat("1", 1024*1024*2)

			timeFd.Append(getTimeType(tsRaw))
			lineField.Append(str)
			lblRaw := `{"_stream_id":"0000000000000000356bfe9e3c71128c750d94c15df6b908","_stream":"{stream=\"stream1\"}","date":"0","stream":"stream1","log.level":"info"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, str, streamID, lblRaw}), labelsField, []string{streamID}, []map[string]string{{"stream": "stream1"}})
		},
	}
	f(o)

	// response with stream fields that include spaces in the label names
	o = opts{
		filename: "test-data/stream_fields_with_spaces_in_names",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-02-20T14:04:27Z"
			timeFd.Append(getTimeType(tsRaw))
			lineField.Append("123")
			lblRaw := `{"_stream":"{Dino Species=\"Stegosaurus\",kubernetes.labels.app.kubernetes.io/instance=\"123\",kubernetes.labels.app.kubernetes.io/name=\"vmagent\",kubernetes.namespace_name=\"monitoring\"}"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, "123", "", lblRaw}), labelsField, []string{""}, []map[string]string{{
				"Dino Species": "Stegosaurus",
				"kubernetes.labels.app.kubernetes.io/instance": "123",
				"kubernetes.labels.app.kubernetes.io/name":     "vmagent",
				"kubernetes.namespace_name":                    "monitoring",
			}})
		},
	}
	f(o)

	// response with stream fields that include slashes in the label names
	o = opts{
		filename: "test-data/stream_fields_with_slashes_names",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			tsRaw := "2024-02-20T14:04:27Z"
			timeFd.Append(getTimeType(tsRaw))
			lineField.Append("123")
			lblRaw := `{"_stream":"{kubernetes.host=\"host1\",kubernetes.labels.app.kubernetes.io/instance=\"123\",kubernetes.labels.app.kubernetes.io/name=\"vmagent\",kubernetes.namespace_name=\"monitoring\"}"}`
			labelsField.Append(json.RawMessage(lblRaw))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, "123", "", lblRaw}), labelsField, []string{""}, []map[string]string{{
				"kubernetes.host": "host1",
				"kubernetes.labels.app.kubernetes.io/instance": "123",
				"kubernetes.labels.app.kubernetes.io/name":     "vmagent",
				"kubernetes.namespace_name":                    "monitoring",
			}})
		},
	}
	f(o)

	// testing bug with empty message field
	o = opts{
		filename: "test-data/bug_with_empty_message_field",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			ts1 := "2025-07-08T09:16:54.721591656Z"
			ts2 := "2025-07-08T09:16:54.734626217Z"
			timeFd.Append(getTimeType(ts1))
			timeFd.Append(getTimeType(ts2))
			lineField.Append("some new message")
			lineField.Append("")
			lbl1 := `{"_stream_id":"1","_stream":"{container.id=\"1\",container.name=\"1\"}","container.id":"1","container.name":"1","fluent.tag":"2fa06040a011","severity":"Unspecified","source":"stdout"}`
			lbl2 := `{"_stream_id":"2","_stream":"{container.id=\"2\",container.name=\"2\"}","container.id":"2","container.name":"2","fluent.tag":"2fa06040a011","severity":"Unspecified","source":"stdout"}`
			labelsField.Append(json.RawMessage(lbl1))
			labelsField.Append(json.RawMessage(lbl2))

			return newFrame(timeFd, lineField, newIDField(
				row{ts1, "some new message", "1", lbl1},
				row{ts2, "", "2", lbl2},
			), labelsField, []string{"1", "2"}, []map[string]string{
				{"container.id": "1", "container.name": "1"},
				{"container.id": "2", "container.name": "2"},
			})
		},
	}
	f(o)

	o = opts{
		filename: "test-data/no_message_and_time_field_one_stream_is_empty",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			timeFd.Append(time.Time{})
			timeFd.Append(time.Time{})
			timeFd.Append(time.Time{})
			lineField.Append("")
			lineField.Append("")
			lineField.Append("")
			lbl1 := `{"logs":"69275","_stream":"{az_id=\"use1-az2\",source=\"vector\",vpc_id=\"vpc\"}"}`
			lbl2 := `{"logs":"5022","_stream":"{namespace=\"ops-monitoring-ns\"}"}`
			lbl3 := `{"logs":"194","_stream":"{}"}`
			labelsField.Append(json.RawMessage(lbl1))
			labelsField.Append(json.RawMessage(lbl2))
			labelsField.Append(json.RawMessage(lbl3))

			return newFrame(timeFd, lineField, newIDField(
				row{"", "", "", lbl1},
				row{"", "", "", lbl2},
				row{"", "", "", lbl3},
			), labelsField, []string{"", "", ""}, []map[string]string{
				{"az_id": "use1-az2", "source": "vector", "vpc_id": "vpc"},
				{"namespace": "ops-monitoring-ns"},
				{},
			})
		},
	}
	f(o)

	// missing `_stream` field: it must come back as nil (JSON null) so the
	// frontend can fall back to `_stream_id`; the second row also lacks
	// `_stream_id`, so both stream fields are absent
	o = opts{
		filename: "test-data/missing_stream_fields",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			ts := "2024-02-20"
			streamID := "00000000000000009eaf29866f70976a098adc735393deb1"
			timeFd.Append(getTimeType(ts))
			timeFd.Append(getTimeType(ts))
			lineField.Append("hello")
			lineField.Append("world")
			lbl1 := `{"_stream_id":"00000000000000009eaf29866f70976a098adc735393deb1"}`
			lbl2 := `{"foo":"bar"}`
			labelsField.Append(json.RawMessage(lbl1))
			labelsField.Append(json.RawMessage(lbl2))

			return newFrame(timeFd, lineField, newIDField(
				row{ts, "hello", streamID, lbl1},
				row{ts, "world", "", lbl2},
			), labelsField, []string{streamID, ""}, []map[string]string{nil, nil})
		},
	}
	f(o)

	o = opts{
		filename: "test-data/empty_stream_with_empty_msg_field",
		want: func() backend.DataResponse {
			timeFd := newField(data.FieldTypeTime, gTimeField)
			lineField := newField(data.FieldTypeString, gLineField)
			labelsField := newField(data.FieldTypeJSON, gLabelsField)

			ts1 := "2025-09-23T14:26:33.559652Z"
			ts2 := "2025-09-23T14:26:33.559441Z"
			msg := "2025-09-23 14:26:33.559569822  172.16.0.110 - - [23/Sep/2025:14:26:33 +0000] \"GET /health HTTP/1.1\" 200 10168 \"-\" \"kube-probe/1.34\" "
			timeFd.Append(getTimeType(ts1))
			timeFd.Append(getTimeType(ts2))
			lineField.Append(msg)
			lineField.Append("")
			lbl1 := `{"_stream_id":"00000000000000000899b9a9578ea0f11a8a45c1b4cc8e34","_stream":"{kubernetes.container_name=\"frigate\",stream=\"stdout\"}","stream":"stdout"}`
			lbl2 := `{"_stream_id":"0000000000000000e934a84adb05276890d7f7bfcadabe92","_stream":"{}"}`
			labelsField.Append(json.RawMessage(lbl1))
			labelsField.Append(json.RawMessage(lbl2))

			return newFrame(timeFd, lineField, newIDField(
				row{ts1, msg, "00000000000000000899b9a9578ea0f11a8a45c1b4cc8e34", lbl1},
				row{ts2, "", "0000000000000000e934a84adb05276890d7f7bfcadabe92", lbl2},
			), labelsField, []string{"00000000000000000899b9a9578ea0f11a8a45c1b4cc8e34", "0000000000000000e934a84adb05276890d7f7bfcadabe92"}, []map[string]string{
				{"kubernetes.container_name": "frigate", "stream": "stdout"},
				{},
			})
		},
	}
	f(o)
}
