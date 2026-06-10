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

// newIDField creates an id field pre-populated for the provided rows.
// Each row is described by its raw (timestamp, _msg, _stream) tuple — the
// same inputs that buildLogID receives in production code.
func newIDField(rows ...struct {
	ts     time.Time
	msg    string
	stream string
}) *data.Field {
	f := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	f.Name = gIDField
	for _, r := range rows {
		f.Append(buildLogID(r.ts, r.msg, r.stream))
	}
	return f
}

type row = struct {
	ts     time.Time
	msg    string
	stream string
}

func Test_buildLogID(t *testing.T) {
	ts := time.Date(2024, 2, 20, 14, 4, 27, 0, time.UTC)

	// stability: same input produces same id
	id1 := buildLogID(ts, "hello", `{a="1"}`)
	id2 := buildLogID(ts, "hello", `{a="1"}`)
	if id1 != id2 {
		t.Errorf("buildLogID is not stable: %s != %s", id1, id2)
	}

	// uniqueness: differing inputs produce different ids
	cases := []struct {
		name string
		ts   time.Time
		msg  string
		stm  string
	}{
		{"baseline", ts, "hello", `{a="1"}`},
		{"different time", ts.Add(time.Nanosecond), "hello", `{a="1"}`},
		{"different msg", ts, "hello!", `{a="1"}`},
		{"different stream", ts, "hello", `{a="2"}`},
	}
	seen := make(map[string]string, len(cases))
	for _, c := range cases {
		id := buildLogID(c.ts, c.msg, c.stm)
		if prev, ok := seen[id]; ok {
			t.Errorf("buildLogID collision between %q and %q -> %s", prev, c.name, id)
		}
		seen[id] = c.name
	}

	// boundary safety: prefix-shifted msg/stream must not collide
	a := buildLogID(ts, "ab", "cd")
	b := buildLogID(ts, "a", "bcd")
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
			t.Errorf("parseInstantResponse() = %#v, want %#v", got, want)
		}
	}

	// empty response
	o := opts{
		filename: "test-data/empty",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			idField := newIDField()

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
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

	// invalid stream in the response
	o = opts{
		filename: "test-data/invalid_stream",
		want: func() backend.DataResponse {
			return newResponseError(fmt.Errorf("_stream field \"hostname=\" must have quoted value"), backend.StatusInternal)
		},
	}
	f(o)

	// empty stream field in the response
	o = opts{
		filename: "test-data/empty_stream",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts := time.Date(2024, 02, 20, 00, 00, 00, 0, time.UTC)
			timeFd.Append(ts)

			lineField.Append("")

			labels := data.Labels{}

			b, _ := labelsToJSON(labels)

			labelsField.Append(b)

			idField := newIDField(row{ts, "", "{}"})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// correct response line
	o = opts{
		filename: "test-data/correct_response",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts := time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC)
			timeFd.Append(ts)

			lineField.Append("123")

			labels := data.Labels{
				"application": "logs-benchmark-Apache.log-1708437847",
				"hostname":    "e28a622d7792",
			}

			b, _ := labelsToJSON(labels)

			labelsField.Append(b)

			stream := `{application="logs-benchmark-Apache.log-1708437847",hostname="e28a622d7792"}`
			idField := newIDField(row{ts, "123", stream})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response with different labels
	o = opts{
		filename: "test-data/different_labels",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts := time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC)
			timeFd.Append(ts)

			lineField.Append("123")

			labels := data.Labels{
				"application": "logs-benchmark-Apache.log-1708437847",
				"hostname":    "e28a622d7792",
				"job":         "vlogs",
			}

			b, _ := labelsToJSON(labels)

			labelsField.Append(b)

			stream := `{application="logs-benchmark-Apache.log-1708437847",hostname="e28a622d7792"}`
			idField := newIDField(row{ts, "123", stream})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response with different labels and without standard fields
	o = opts{
		filename: "test-data/no_standard_fields",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			timeFd.Append(now)
			timeFd.Append(now)

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

			// _time absent → rowTime is zero in buildLogID; nowFunc is only used to
			// pad timeFd for visualization purposes.
			idField := newIDField(
				row{time.Time{}, "", ""},
				row{time.Time{}, "", ""},
			)

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response with different labels only one label
	o = opts{
		filename: "test-data/only_one_label",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			timeFd.Append(now)

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			lineField.Append(`{"level":""}`)

			labels := data.Labels{
				"level": "",
			}

			b, _ := labelsToJSON(labels)
			labelsField.Append(b)

			idField := newIDField(row{time.Time{}, "", ""})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response when one stream field is defined and other is free fields
	o = opts{
		filename: "test-data/stream_and_free_field",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts1 := time.Date(2024, 06, 26, 13, 00, 00, 0, time.UTC)
			ts2 := time.Date(2024, 06, 26, 14, 00, 00, 0, time.UTC)
			timeFd.Append(ts1)
			timeFd.Append(ts2)

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

			// No _msg and no _stream in this fixture — lineField is later
			// filled from labelsField by the parseInstantResponse fallback,
			// but buildLogID was called with empty rowMsg/rowStream before that.
			idField := newIDField(
				row{ts1, "", ""},
				row{ts2, "", ""},
			)

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response has ANSI chars
	o = opts{
		filename: "test-data/ANSI_chars",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts := time.Date(2024, 06, 26, 13, 15, 15, 0, time.UTC)
			timeFd.Append(ts)

			msg := `\x1b[2m2024-06-26T13:15:15.004Z\x1b[0;39m \x1b[32mTRACE\x1b[0;39m \x1b[35m1\x1b[0;39m \x1b[2m---\x1b[0;39m \x1b[2m[    parallel-19]\x1b[0;39m \x1b[36mo.s.c.g.f.WeightCalculatorWebFilter     \x1b[0;39m \x1b[2m:\x1b[0;39m Weights attr: {} `
			lineField.Append(msg)

			labels := data.Labels{
				"compose_project": "app",
				"compose_service": "gateway",
				"_stream_id":      "00000000000000009eaf29866f70976a098adc735393deb1",
			}

			b, _ := labelsToJSON(labels)
			labelsField.Append(b)

			stream := `{compose_project="app",compose_service="gateway"}`
			idField := newIDField(row{ts, msg, stream})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response has unicode
	o = opts{
		filename: "test-data/unicode_present",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts := time.Date(2024, 06, 26, 13, 20, 34, 0, time.UTC)
			timeFd.Append(ts)

			value, err := fastjson.Parse(`{"_msg":"\u001b[2m2024-06-26T13:20:34.608Z\u001b[0;39m \u001b[33m WARN\u001b[0;39m \u001b[35m1\u001b[0;39m \u001b[2m---\u001b[0;39m \u001b[2m[           main]\u001b[0;39m \u001b[36mjakarta.persistence.spi                 \u001b[0;39m \u001b[2m:\u001b[0;39m jakarta.persistence.spi::No valid providers found. "}`)
			if err != nil {
				t.Fatalf("error decode response: %s", err)
			}

			var msg string
			if value.Exists(messageField) {
				message := value.GetStringBytes(messageField)
				msg = string(message)
				lineField.Append(msg)
			}

			labels := data.Labels{
				"compose_project": "app",
				"compose_service": "gateway",
			}

			b, _ := labelsToJSON(labels)
			labelsField.Append(b)

			stream := `{compose_project="app",compose_service="gateway"}`
			idField := newIDField(row{ts, msg, stream})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response has labels and message, time field is empty
	o = opts{
		filename: "test-data/time_field_empty",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			timeFd.Append(now)

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			lineField.Append("507")

			labels := data.Labels{
				"count": "507",
			}

			b, _ := labelsToJSON(labels)
			labelsField.Append(b)

			idField := newIDField(row{time.Time{}, "507", ""})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// double labels
	o = opts{
		filename: "test-data/double_labels",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts1 := time.Date(2024, 9, 10, 12, 24, 38, 124811000, time.UTC)
			ts2 := time.Date(2024, 9, 10, 12, 36, 10, 664553169, time.UTC)
			ts3 := time.Date(2024, 9, 10, 13, 06, 56, 451470000, time.UTC)
			timeFd.Append(ts1)
			timeFd.Append(ts2)
			timeFd.Append(ts3)

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

			stream1and3 := `{path="/var/lib/docker/containers/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89/c01cbe414773fa6b3e4e0976fb27c3583b1a5cd4b7007662477df66987f97f89-json.log",stream="stderr"}`
			stream2 := `{stream="stream1"}`
			idField := newIDField(
				row{ts1, "1", stream1and3},
				row{ts2, "2", stream2},
				row{ts3, "3", stream1and3},
			)

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// large response more than 1MB
	o = opts{
		filename: "test-data/large_msg_response_2MB",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts := time.Date(2024, 9, 10, 12, 36, 10, 664553169, time.UTC)
			timeFd.Append(ts)

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

			stream := `{stream="stream1"}`
			idField := newIDField(row{ts, str, stream})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response with empty stream fields includes '/' in the label names
	o = opts{
		filename: "test-data/stream_fields_with_spaces_in_names",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts := time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC)
			timeFd.Append(ts)

			lineField.Append("123")

			labels := data.Labels{
				"Dino Species": "Stegosaurus",
				"kubernetes.labels.app.kubernetes.io/instance": "123",
				"kubernetes.labels.app.kubernetes.io/name":     "vmagent",
				"kubernetes.namespace_name":                    "monitoring",
			}

			b, _ := labelsToJSON(labels)

			labelsField.Append(b)

			stream := `{Dino Species="Stegosaurus",kubernetes.labels.app.kubernetes.io/instance="123",kubernetes.labels.app.kubernetes.io/name="vmagent",kubernetes.namespace_name="monitoring"}`
			idField := newIDField(row{ts, "123", stream})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// response with stream fields includes spaces in the label names
	o = opts{
		filename: "test-data/stream_fields_with_slashes_names",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts := time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC)
			timeFd.Append(ts)

			lineField.Append("123")

			labels := data.Labels{
				"kubernetes.host": "host1",
				"kubernetes.labels.app.kubernetes.io/instance": "123",
				"kubernetes.labels.app.kubernetes.io/name":     "vmagent",
				"kubernetes.namespace_name":                    "monitoring",
			}

			b, _ := labelsToJSON(labels)

			labelsField.Append(b)

			stream := `{kubernetes.host="host1",kubernetes.labels.app.kubernetes.io/instance="123",kubernetes.labels.app.kubernetes.io/name="vmagent",kubernetes.namespace_name="monitoring"}`
			idField := newIDField(row{ts, "123", stream})

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	// testing bug with empty message field
	o = opts{
		filename: "test-data/bug_with_empty_message_field",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts1 := time.Date(2025, 7, 8, 9, 16, 54, 721591656, time.UTC)
			ts2 := time.Date(2025, 7, 8, 9, 16, 54, 734626217, time.UTC)
			timeFd.Append(ts1)
			timeFd.Append(ts2)

			lineField.Append("some new message")

			labels := data.Labels{
				"_stream_id":     "1",
				"container.id":   "1",
				"container.name": "1",
				"fluent.tag":     "2fa06040a011",
				"severity":       "Unspecified",
				"source":         "stdout",
			}

			b, _ := labelsToJSON(labels)
			labelsField.Append(b)

			lineField.Append("")

			labels = data.Labels{
				"_stream_id":     "2",
				"container.id":   "2",
				"container.name": "2",
				"fluent.tag":     "2fa06040a011",
				"severity":       "Unspecified",
				"source":         "stdout",
			}

			b, _ = labelsToJSON(labels)
			labelsField.Append(b)

			stream1 := `{container.id="1",container.name="1"}`
			stream2 := `{container.id="2",container.name="2"}`
			idField := newIDField(
				row{ts1, "some new message", stream1},
				row{ts2, "", stream2},
			)

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	o = opts{
		filename: "test-data/no_message_and_time_field_one_stream_is_empty",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			timeFd.Append(nowFunc())
			timeFd.Append(nowFunc())
			timeFd.Append(nowFunc())

			lineField.Append("")

			labels := data.Labels{
				"logs":   "69275",
				"az_id":  "use1-az2",
				"source": "vector",
				"vpc_id": "vpc",
			}

			b, _ := labelsToJSON(labels)
			labelsField.Append(b)

			lineField.Append("")

			labels = data.Labels{
				"logs":      "5022",
				"namespace": "ops-monitoring-ns",
			}

			b, _ = labelsToJSON(labels)
			labelsField.Append(b)

			lineField.Append("")

			labels = data.Labels{
				"logs": "194",
			}

			b, _ = labelsToJSON(labels)
			labelsField.Append(b)

			idField := newIDField(
				row{time.Time{}, "", `{az_id="use1-az2",source="vector",vpc_id="vpc"}`},
				row{time.Time{}, "", `{namespace="ops-monitoring-ns"}`},
				row{time.Time{}, "", `{}`},
			)

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)

	o = opts{
		filename: "test-data/empty_stream_with_empty_msg_field",
		want: func() backend.DataResponse {
			labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
			labelsField.Name = gLabelsField

			timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			timeFd.Name = gTimeField

			lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
			lineField.Name = gLineField

			ts1 := time.Date(2025, 9, 23, 14, 26, 33, 559652000, time.UTC)
			ts2 := time.Date(2025, 9, 23, 14, 26, 33, 559441000, time.UTC)
			timeFd.Append(ts1)
			timeFd.Append(ts2)

			msg := "2025-09-23 14:26:33.559569822  172.16.0.110 - - [23/Sep/2025:14:26:33 +0000] \"GET /health HTTP/1.1\" 200 10168 \"-\" \"kube-probe/1.34\" "
			lineField.Append(msg)

			labels := data.Labels{
				"_stream_id":                "00000000000000000899b9a9578ea0f11a8a45c1b4cc8e34",
				"kubernetes.container_name": "frigate",
				"stream":                    "stdout",
			}

			b, _ := labelsToJSON(labels)
			labelsField.Append(b)

			lineField.Append("")

			labels = data.Labels{
				"_stream_id": "0000000000000000e934a84adb05276890d7f7bfcadabe92",
			}

			b, _ = labelsToJSON(labels)
			labelsField.Append(b)

			stream1 := `{kubernetes.container_name="frigate",stream="stdout"}`
			idField := newIDField(
				row{ts1, msg, stream1},
				row{ts2, "", `{}`},
			)

			frame := data.NewFrame("", timeFd, lineField, idField, labelsField)

			rsp := backend.DataResponse{}
			frame.Meta = &data.FrameMeta{}
			rsp.Frames = append(rsp.Frames, frame)

			return rsp
		},
	}
	f(o)
}
