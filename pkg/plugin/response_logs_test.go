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
}

// newIDField creates an id field pre-populated for the provided rows.
func newIDField(rows ...row) *data.Field {
	f := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	f.Name = gIDField
	for _, r := range rows {
		f.Append(buildLogID([]byte(r.ts), []byte(r.msg), []byte(r.streamID)))
	}
	return f
}

func Test_buildLogID(t *testing.T) {
	ts := []byte("2024-02-20T14:04:27Z")

	// stability: same input produces same id
	id1 := buildLogID(ts, []byte("hello"), []byte(`{a="1"}`))
	id2 := buildLogID(ts, []byte("hello"), []byte(`{a="1"}`))
	if id1 != id2 {
		t.Errorf("buildLogID is not stable: %s != %s", id1, id2)
	}

	// uniqueness: differing inputs produce different ids
	cases := []struct {
		name string
		ts   string
		msg  string
		stm  string
	}{
		{"baseline", "2024-02-20T14:04:27Z", "hello", `{a="1"}`},
		{"different time", "2024-02-20T14:04:27.000000001Z", "hello", `{a="1"}`},
		{"different msg", "2024-02-20T14:04:27Z", "hello!", `{a="1"}`},
		{"different stream", "2024-02-20T14:04:27Z", "hello", `{a="2"}`},
	}
	seen := make(map[string]string, len(cases))
	for _, c := range cases {
		id := buildLogID([]byte(c.ts), []byte(c.msg), []byte(c.stm))
		if prev, ok := seen[id]; ok {
			t.Errorf("buildLogID collision between %q and %q -> %s", prev, c.name, id)
		}
		seen[id] = c.name
	}

	// boundary safety: prefix-shifted msg/stream must not collide
	a := buildLogID(ts, []byte("ab"), []byte("cd"))
	b := buildLogID(ts, []byte("a"), []byte("bcd"))
	if a == b {
		t.Errorf("buildLogID collides across msg/stream boundary: %s", a)
	}
}

func Test_parseInstantResponse(t *testing.T) {
	now := time.Now()
	nowFunc = func() time.Time {
		return now
	}
	defer func() {
		nowFunc = time.Now
	}()

	// mustTime parses a raw _time string the same way production does.
	getTimeType := func(s string) time.Time {
		tt, err := utils.GetTime(s)
		if err != nil {
			t.Fatalf("error parse time %q: %s", s, err)
		}
		return tt
	}

	// newFrame assembles an expected logs frame from its four fields plus the
	// per-row stream data carried in meta.custom for the "Show context" UI.
	newFrame := func(timeFd, lineField, idField, labelsField *data.Field, streamIds []string, streams []map[string]string) backend.DataResponse {
		frame := data.NewFrame("", timeFd, lineField, idField, labelsField)
		frame.Meta = &data.FrameMeta{
			Custom: map[string]any{
				"streamIds": streamIds,
				"streams":   streams,
			},
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
		resp := parseInstantResponse(r)

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
			labelsField.Append(json.RawMessage(`{}`))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msgRaw, ""}), labelsField, []string{""}, []map[string]string{{}})
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
			labelsField.Append(json.RawMessage(`{}`))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msgRaw, ""}), labelsField, []string{""}, []map[string]string{{"application": "logs-benchmark-Apache.log-1708437847", "hostname": "e28a622d7792"}})
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
			labelsField.Append(json.RawMessage(`{"job":"vlogs"}`))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msgRaw, ""}), labelsField, []string{""}, []map[string]string{{"application": "logs-benchmark-Apache.log-1708437847", "hostname": "e28a622d7792"}})
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

			timeFd.Append(now)
			timeFd.Append(now)
			lineField.Append("")
			lineField.Append("")
			labelsField.Append(json.RawMessage(`{"stream":"stderr","count(*)":"394"}`))
			labelsField.Append(json.RawMessage(`{"stream":"stdout","count(*)":"21"}`))
			idField := newIDField(
				row{"", "", ""},
				row{"", "", ""},
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

			timeFd.Append(now)
			lineField.Append("")
			labelsField.Append(json.RawMessage(`{"level":""}`))

			return newFrame(timeFd, lineField, newIDField(row{"", "", ""}), labelsField, []string{""}, []map[string]string{nil})
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
			labelsField.Append(json.RawMessage(`{"logs":"1400"}`))
			labelsField.Append(json.RawMessage(`{"logs":"374"}`))

			return newFrame(timeFd, lineField, newIDField(row{ts1, "", ""}, row{ts2, "", ""}), labelsField, []string{"", ""}, []map[string]string{nil, nil})
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
			labelsField.Append(json.RawMessage(`{"_stream_id":"00000000000000009eaf29866f70976a098adc735393deb1","compose_project":"app","compose_service":"gateway"}`))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msg, streamID}), labelsField, []string{streamID}, []map[string]string{{"compose_project": "app", "compose_service": "gateway"}})
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
			labelsField.Append(json.RawMessage(`{"compose_project":"app","compose_service":"gateway"}`))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, msg, ""}), labelsField, []string{""}, []map[string]string{{"compose_project": "app", "compose_service": "gateway"}})
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

			timeFd.Append(now)
			lineField.Append("507")
			labelsField.Append(json.RawMessage(`{"count":"507"}`))

			return newFrame(timeFd, lineField, newIDField(row{"", "507", ""}), labelsField, []string{""}, []map[string]string{nil})
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
			timeFd.Append(now)
			lineField.Append("123")
			lineField.Append("456")
			labelsField.Append(json.RawMessage(`{"_stream":"{app=\"test\"}"}`))
			labelsField.Append(json.RawMessage(`{"_stream":"{app=\"test\"}"}`))

			return newFrame(
				timeFd,
				lineField,
				newIDField(
					row{tsRaw, "123", ""},
					row{"", "456", ""},
				),
				labelsField,
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
			labelsField.Append(json.RawMessage(`{"_stream_id":"00000000000000002e3bd2bdc376279a6418761ca20c417c","path":"/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log","stream":"stderr","time":"2024-09-10T12:24:38.124811792Z"}`))
			labelsField.Append(json.RawMessage(`{"_stream_id":"0000000000000000356bfe9e3c71128c750d94c15df6b908","date":"0","stream":"stream1","log.level":"info"}`))
			labelsField.Append(json.RawMessage(`{"_stream_id":"00000000000000002e3bd2bdc376279a6418761ca20c417c","path":"/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log","stream":"stderr","time":"2024-09-10T13:06:56.451470093Z"}`))

			pathValue := "/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log"
			return newFrame(timeFd, lineField, newIDField(
				row{ts1, "1", sid13},
				row{ts2, "2", sid2},
				row{ts3, "3", sid13},
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
			labelsField.Append(json.RawMessage(`{"_stream_id":"0000000000000000356bfe9e3c71128c750d94c15df6b908","date":"0","stream":"stream1","log.level":"info"}`))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, str, streamID}), labelsField, []string{streamID}, []map[string]string{{"stream": "stream1"}})
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
			labelsField.Append(json.RawMessage(`{}`))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, "123", ""}), labelsField, []string{""}, []map[string]string{{
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
			labelsField.Append(json.RawMessage(`{}`))

			return newFrame(timeFd, lineField, newIDField(row{tsRaw, "123", ""}), labelsField, []string{""}, []map[string]string{{
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
			labelsField.Append(json.RawMessage(`{"_stream_id":"1","container.id":"1","container.name":"1","fluent.tag":"2fa06040a011","severity":"Unspecified","source":"stdout"}`))
			labelsField.Append(json.RawMessage(`{"_stream_id":"2","container.id":"2","container.name":"2","fluent.tag":"2fa06040a011","severity":"Unspecified","source":"stdout"}`))

			return newFrame(timeFd, lineField, newIDField(
				row{ts1, "some new message", "1"},
				row{ts2, "", "2"},
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

			timeFd.Append(now)
			timeFd.Append(now)
			timeFd.Append(now)
			lineField.Append("")
			lineField.Append("")
			lineField.Append("")
			labelsField.Append(json.RawMessage(`{"logs":"69275"}`))
			labelsField.Append(json.RawMessage(`{"logs":"5022"}`))
			labelsField.Append(json.RawMessage(`{"logs":"194"}`))

			return newFrame(timeFd, lineField, newIDField(
				row{"", "", ""},
				row{"", "", ""},
				row{"", "", ""},
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
			labelsField.Append(json.RawMessage(`{"_stream_id":"00000000000000009eaf29866f70976a098adc735393deb1"}`))
			labelsField.Append(json.RawMessage(`{"foo":"bar"}`))

			return newFrame(timeFd, lineField, newIDField(
				row{ts, "hello", streamID},
				row{ts, "world", ""},
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
			labelsField.Append(json.RawMessage(`{"_stream_id":"00000000000000000899b9a9578ea0f11a8a45c1b4cc8e34","stream":"stdout"}`))
			labelsField.Append(json.RawMessage(`{"_stream_id":"0000000000000000e934a84adb05276890d7f7bfcadabe92"}`))

			return newFrame(timeFd, lineField, newIDField(
				row{ts1, msg, "00000000000000000899b9a9578ea0f11a8a45c1b4cc8e34"},
				row{ts2, "", "0000000000000000e934a84adb05276890d7f7bfcadabe92"},
			), labelsField, []string{"00000000000000000899b9a9578ea0f11a8a45c1b4cc8e34", "0000000000000000e934a84adb05276890d7f7bfcadabe92"}, []map[string]string{
				{"kubernetes.container_name": "frigate", "stream": "stdout"},
				{},
			})
		},
	}
	f(o)
}
