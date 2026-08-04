package plugin

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
)

func Test_logReader_parseRow(t *testing.T) {
	lr := newLogReader(strings.NewReader(""))

	line := `{"_time":"2024-02-20T14:04:27Z","_msg":"hello","_stream_id":"sid1","_stream":"{app=\"test\"}","foo":"bar"}`
	row, err := lr.parseRow([]byte(line))
	if err != nil {
		t.Fatalf("parseRow() unexpected error: %s", err)
	}

	wantTime, err := utils.GetTime("2024-02-20T14:04:27Z")
	if err != nil {
		t.Fatalf("error parse expected time: %s", err)
	}
	if !row.Time.Equal(wantTime) {
		t.Errorf("Time = %s, want %s", row.Time, wantTime)
	}
	if row.Line != "hello" {
		t.Errorf("Line = %q, want %q", row.Line, "hello")
	}
	if row.StreamID != "sid1" {
		t.Errorf("StreamID = %q, want %q", row.StreamID, "sid1")
	}
	if want := map[string]string{"app": "test"}; !reflect.DeepEqual(row.Stream, want) {
		t.Errorf("Stream = %#v, want %#v", row.Stream, want)
	}

	// labels keep everything except the extracted _time/_msg fields
	var labels map[string]string
	if err := json.Unmarshal(row.Labels, &labels); err != nil {
		t.Fatalf("error unmarshal labels: %s", err)
	}
	wantLabels := map[string]string{
		"_stream_id": "sid1",
		"_stream":    `{app="test"}`,
		"foo":        "bar",
	}
	if !reflect.DeepEqual(labels, wantLabels) {
		t.Errorf("Labels = %#v, want %#v", labels, wantLabels)
	}

	if want := buildLogID([]byte("2024-02-20T14:04:27Z"), []byte("hello"), []byte("sid1"), row.Labels); row.ID != want {
		t.Errorf("ID = %s, want %s", row.ID, want)
	}

	// missing _time falls back to the zero time on purpose
	row, err = lr.parseRow([]byte(`{"_msg":"no time"}`))
	if err != nil {
		t.Fatalf("parseRow() unexpected error: %s", err)
	}
	if !row.Time.IsZero() {
		t.Errorf("Time = %s, want zero time for a row without _time", row.Time)
	}
}

func Test_logReader_parseRow_errors(t *testing.T) {
	cases := []struct {
		name    string
		line    string
		wantErr string
	}{
		{"invalid json", `abcd`, "error decode response"},
		{"json is not an object", `[1,2]`, "value doesn't contain object"},
		{"invalid _time", `{"_time":"acdf"}`, "error parse time from _time field"},
		{"invalid _stream", `{"_time":"2024-02-20T14:04:27Z","_stream":"{hostname=}"}`, "error parse _stream field"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := newLogReader(strings.NewReader("")).parseRow([]byte(c.line))
			if err == nil {
				t.Fatalf("parseRow(%q) expected error, got nil", c.line)
			}
			if !strings.Contains(err.Error(), c.wantErr) {
				t.Errorf("parseRow(%q) error = %q, want it to contain %q", c.line, err, c.wantErr)
			}
		})
	}
}

func Test_logReader_parseRow_deduplicatesIDs(t *testing.T) {
	line := []byte(`{"_time":"2024-02-20T14:04:27Z","_msg":"dup","_stream_id":"sid1"}`)

	lr := newLogReader(strings.NewReader(""))
	first, err := lr.parseRow(line)
	if err != nil {
		t.Fatalf("parseRow() unexpected error: %s", err)
	}
	second, err := lr.parseRow(line)
	if err != nil {
		t.Fatalf("parseRow() unexpected error: %s", err)
	}
	if want := first.ID + "_1"; second.ID != want {
		t.Errorf("second identical row ID = %s, want %s", second.ID, want)
	}

	// the seen-id state is scoped to one reader: a fresh reader starts over
	fresh, err := newLogReader(strings.NewReader("")).parseRow(line)
	if err != nil {
		t.Fatalf("parseRow() unexpected error: %s", err)
	}
	if fresh.ID != first.ID {
		t.Errorf("fresh reader ID = %s, want %s", fresh.ID, first.ID)
	}
}
