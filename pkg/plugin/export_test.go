package plugin

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestParseExportQuery(t *testing.T) {
	valid := func() url.Values {
		return url.Values{
			"query":  {"error"},
			"start":  {"1000"},
			"end":    {"2000"},
			"format": {"jsonl"},
		}
	}

	t.Run("valid", func(t *testing.T) {
		values := valid()
		values.Set("extra_filters", `{"level":"error"}`)
		values.Set("extra_stream_filters", `{app="nginx"}`)
		values.Set("limit", "10")
		values.Set("interval_ms", "30000")

		got, err := parseExportQuery(values)
		if err != nil {
			t.Fatalf("unexpected error: %s", err)
		}
		want := exportQuery{
			Expr:               "error",
			ExtraFilters:       `{"level":"error"}`,
			ExtraStreamFilters: `{app="nginx"}`,
			StartMs:            1000,
			EndMs:              2000,
			IntervalMs:         30000,
			Format:             exportFormatJSONLines,
		}
		if got != want {
			t.Fatalf("got %+v, want %+v", got, want)
		}
	})

	invalid := map[string]func(url.Values){
		"empty query":                 func(v url.Values) { v.Set("query", "  ") },
		"missing start":               func(v url.Values) { v.Del("start") },
		"non-numeric start":           func(v url.Values) { v.Set("start", "now-1h") },
		"non-numeric end":             func(v url.Values) { v.Set("end", "now") },
		"start overflows nanoseconds": func(v url.Values) { v.Set("start", "-9223372036855") },
		"end overflows nanoseconds":   func(v url.Values) { v.Set("end", "9223372036855") },
		"start equals end":            func(v url.Values) { v.Set("start", "2000") },
		"start after end":             func(v url.Values) { v.Set("start", "3000") },
		"non-numeric interval":        func(v url.Values) { v.Set("interval_ms", "30s") },
		"negative interval":           func(v url.Values) { v.Set("interval_ms", "-1") },
		"missing format":              func(v url.Values) { v.Del("format") },
		"unknown format":              func(v url.Values) { v.Set("format", "xml") },
	}
	for name, breakValues := range invalid {
		t.Run(name, func(t *testing.T) {
			values := valid()
			breakValues(values)
			if _, err := parseExportQuery(values); err == nil {
				t.Fatalf("expected an error for %v", values)
			}
		})
	}
}

func TestExportQueryURL(t *testing.T) {
	query := exportQuery{
		Expr:               "error | fields _time, _msg",
		ExtraFilters:       `{"level":"error"}`,
		ExtraStreamFilters: `{app="nginx"}`,
		StartMs:            1000,
		EndMs:              2000,
		Format:             exportFormatCSV,
	}

	rawURL, err := query.url("http://vl:9428/prefix?token=abc", "tenant=1")
	if err != nil {
		t.Fatalf("unexpected error: %s", err)
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("the result is not a URL: %s", err)
	}
	if u.Path != "/prefix/select/logsql/query" {
		t.Fatalf("unexpected path %q", u.Path)
	}
	want := url.Values{
		"token":                {"abc"},
		"tenant":               {"1"},
		"query":                {"error | fields _time, _msg"},
		"start":                {"1000000000"},
		"end":                  {"2000000000"},
		"extra_filters":        {`{"level":"error"}`},
		"extra_stream_filters": {`{app="nginx"}`},
		"format":               {"csv"},
	}
	if got := u.Query(); got.Encode() != want.Encode() {
		t.Fatalf("got query %q, want %q", got.Encode(), want.Encode())
	}

	t.Run("JSON lines without filters", func(t *testing.T) {
		query := exportQuery{Expr: "*", StartMs: 1, EndMs: 2, Format: exportFormatJSONLines}
		rawURL, err := query.url("http://vl:9428", "")
		if err != nil {
			t.Fatalf("unexpected error: %s", err)
		}
		u, err := url.Parse(rawURL)
		if err != nil {
			t.Fatalf("the result is not a URL: %s", err)
		}
		for _, param := range []string{"format", "extra_filters", "extra_stream_filters", "limit", "sort_direction"} {
			if u.Query().Has(param) {
				t.Fatalf("unexpected %q in %q", param, rawURL)
			}
		}
	})

	t.Run("ignores the limit and the format of the datasource settings", func(t *testing.T) {
		query := exportQuery{Expr: "*", StartMs: 1, EndMs: 2, Format: exportFormatJSONLines}
		rawURL, err := query.url("http://vl:9428?limit=5", "limit=10&format=csv&tenant=1")
		if err != nil {
			t.Fatalf("unexpected error: %s", err)
		}
		u, err := url.Parse(rawURL)
		if err != nil {
			t.Fatalf("the result is not a URL: %s", err)
		}
		want := url.Values{"tenant": {"1"}, "query": {"*"}, "start": {"1000000"}, "end": {"2000000"}}
		if got := u.Query(); got.Encode() != want.Encode() {
			t.Fatalf("got query %q, want %q", got.Encode(), want.Encode())
		}
	})

	t.Run("replaces the interval and range variables as a data query does", func(t *testing.T) {
		query := exportQuery{
			Expr:       "* | stats by (_time:$__interval) count() | math $__interval_ms | filter _time:$__range",
			StartMs:    1000,
			EndMs:      61000,
			IntervalMs: 30000,
			Format:     exportFormatJSONLines,
		}
		rawURL, err := query.url("http://vl:9428", "")
		if err != nil {
			t.Fatalf("unexpected error: %s", err)
		}
		u, err := url.Parse(rawURL)
		if err != nil {
			t.Fatalf("the result is not a URL: %s", err)
		}
		want := "* | stats by (_time:30s) count() | math 30000 | filter _time:[1, 61]"
		if got := u.Query().Get("query"); got != want {
			t.Fatalf("got query %q, want %q", got, want)
		}
	})

	t.Run("blank datasource URL", func(t *testing.T) {
		if _, err := query.url("", ""); err == nil {
			t.Fatal("expected an error")
		}
	})

	t.Run("invalid custom query parameters", func(t *testing.T) {
		if _, err := query.url("http://vl:9428", "a=%zz"); err == nil {
			t.Fatal("expected an error")
		}
	})
}

type flushCountingWriter struct {
	*httptest.ResponseRecorder
	flushes int
}

func (w *flushCountingWriter) Flush() {
	w.flushes++
}

// oneChunkReader returns at most chunkBytes for each Read, as a network connection does
type oneChunkReader struct {
	src        io.Reader
	chunkBytes int
}

func (r oneChunkReader) Read(p []byte) (int, error) {
	if len(p) > r.chunkBytes {
		p = p[:r.chunkBytes]
	}
	return r.src.Read(p)
}

type failingReader struct {
	data []byte
	err  error
}

func (r *failingReader) Read(p []byte) (int, error) {
	if len(r.data) == 0 {
		return 0, r.err
	}
	n := copy(p, r.data)
	r.data = r.data[n:]
	return n, nil
}

func TestCopyFlushing(t *testing.T) {
	t.Run("flushes every chunk", func(t *testing.T) {
		body := strings.Repeat("a", 2500)
		w := &flushCountingWriter{ResponseRecorder: httptest.NewRecorder()}

		if err := copyFlushing(w, oneChunkReader{src: strings.NewReader(body), chunkBytes: 1000}); err != nil {
			t.Fatalf("unexpected error: %s", err)
		}
		if w.Body.String() != body {
			t.Fatalf("got %d bytes, want %d", w.Body.Len(), len(body))
		}
		if w.flushes != 3 {
			t.Fatalf("got %d flushes, want 3", w.flushes)
		}
	})

	t.Run("returns the read error after the received part", func(t *testing.T) {
		readErr := errors.New("connection reset by peer")
		w := &flushCountingWriter{ResponseRecorder: httptest.NewRecorder()}

		err := copyFlushing(w, &failingReader{data: []byte("partial"), err: readErr})
		if !errors.Is(err, readErr) {
			t.Fatalf("got error %v, want %v", err, readErr)
		}
		if w.Body.String() != "partial" {
			t.Fatalf("got body %q, want %q", w.Body.String(), "partial")
		}
	})
}

func exportPluginContext(datasourceURL, jsonData string) backend.PluginContext {
	return backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      datasourceURL,
			JSONData: []byte(jsonData),
		},
	}
}

func callExportHandler(method, target string, pluginCtx backend.PluginContext) *httptest.ResponseRecorder {
	ctx := backend.WithPluginContext(context.Background(), pluginCtx)
	req := httptest.NewRequest(method, target, nil).WithContext(ctx)
	rr := httptest.NewRecorder()
	NewDatasource().VLExportLogs(rr, req)
	return rr
}

const exportTarget = "/export/logs?query=error&start=1000&end=2000&format=csv&extra_filters=%7B%22level%22%3A%22error%22%7D"

func TestVLExportLogs(t *testing.T) {
	t.Run("proxies the response as an attachment", func(t *testing.T) {
		var upstreamReq *http.Request
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			upstreamReq = r.Clone(context.Background())
			w.Header().Set("Content-Type", "text/csv")
			_, _ = w.Write([]byte("_time,_msg\n1,error\n"))
		}))
		defer upstream.Close()
		jsonData := `{"httpMethod":"POST","customQueryParameters":"tenant=1","multitenancyHeaders":{"AccountID":"7","ProjectID":"9"}}`

		rr := callExportHandler(http.MethodGet, exportTarget, exportPluginContext(upstream.URL, jsonData))

		if rr.Code != http.StatusOK {
			t.Fatalf("got status %d, body %s", rr.Code, rr.Body.String())
		}
		if rr.Body.String() != "_time,_msg\n1,error\n" {
			t.Fatalf("unexpected body %q", rr.Body.String())
		}
		if got := rr.Header().Get("Content-Type"); got != "text/csv" {
			t.Fatalf("unexpected Content-Type %q", got)
		}
		if got := rr.Header().Get("Content-Disposition"); got != `attachment; filename="export.csv"` {
			t.Fatalf("unexpected Content-Disposition %q", got)
		}
		if upstreamReq.Method != http.MethodPost {
			t.Fatalf("got upstream method %s, want POST", upstreamReq.Method)
		}
		if upstreamReq.URL.Path != instantQueryPath {
			t.Fatalf("unexpected upstream path %q", upstreamReq.URL.Path)
		}
		wantQuery := url.Values{
			"tenant":        {"1"},
			"query":         {"error"},
			"start":         {"1000000000"},
			"end":           {"2000000000"},
			"extra_filters": {`{"level":"error"}`},
			"format":        {"csv"},
		}
		if got := upstreamReq.URL.Query().Encode(); got != wantQuery.Encode() {
			t.Fatalf("got upstream query %q, want %q", got, wantQuery.Encode())
		}
		if got := upstreamReq.Header.Get(accountIDHeader); got != "7" {
			t.Fatalf("got %s %q, want 7", accountIDHeader, got)
		}
		if got := upstreamReq.Header.Get(projectIDHeader); got != "9" {
			t.Fatalf("got %s %q, want 9", projectIDHeader, got)
		}
	})

	t.Run("rejects other methods", func(t *testing.T) {
		rr := callExportHandler(http.MethodPost, exportTarget, exportPluginContext("http://127.0.0.1:1", `{}`))
		if rr.Code != http.StatusMethodNotAllowed {
			t.Fatalf("got status %d, want %d", rr.Code, http.StatusMethodNotAllowed)
		}
	})

	t.Run("rejects an invalid query", func(t *testing.T) {
		rr := callExportHandler(http.MethodGet, "/export/logs?query=error", exportPluginContext("http://127.0.0.1:1", `{}`))
		if rr.Code == http.StatusOK {
			t.Fatalf("expected an error status, body %s", rr.Body.String())
		}
		if rr.Header().Get("Content-Disposition") != "" {
			t.Fatal("an error must not be an attachment")
		}
	})

	t.Run("reports the VictoriaLogs error", func(t *testing.T) {
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "cannot parse query", http.StatusBadRequest)
		}))
		defer upstream.Close()

		rr := callExportHandler(http.MethodGet, exportTarget, exportPluginContext(upstream.URL, `{}`))

		if rr.Code == http.StatusOK {
			t.Fatalf("expected an error status, body %s", rr.Body.String())
		}
		if !strings.Contains(rr.Body.String(), "cannot parse query") {
			t.Fatalf("the error is not reported: %s", rr.Body.String())
		}
		if rr.Header().Get("Content-Disposition") != "" {
			t.Fatal("an error must not be an attachment")
		}
	})

	t.Run("rejects a response that is not CSV for the CSV format", func(t *testing.T) {
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/stream+json")
			_, _ = w.Write([]byte(`{"_msg":"error"}` + "\n"))
		}))
		defer upstream.Close()

		rr := callExportHandler(http.MethodGet, exportTarget, exportPluginContext(upstream.URL, `{}`))

		if rr.Code == http.StatusOK {
			t.Fatalf("expected an error status, body %s", rr.Body.String())
		}
		if !strings.Contains(rr.Body.String(), "not CSV") {
			t.Fatalf("the error is not reported: %s", rr.Body.String())
		}
		if rr.Header().Get("Content-Disposition") != "" {
			t.Fatal("an error must not be an attachment")
		}
	})

	t.Run("ignores the response limit of Grafana", func(t *testing.T) {
		t.Setenv("GF_DATAPROXY_RESPONSE_LIMIT", "10")
		body := strings.Repeat("a", 100)
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/csv; charset=utf-8")
			_, _ = w.Write([]byte(body))
		}))
		defer upstream.Close()

		rr := callExportHandler(http.MethodGet, exportTarget, exportPluginContext(upstream.URL, `{}`))

		if rr.Body.String() != body {
			t.Fatalf("got %d bytes, want %d", rr.Body.Len(), len(body))
		}
	})

	t.Run("sends the request one time when VictoriaLogs drops the connection", func(t *testing.T) {
		var requests atomic.Int32
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			requests.Add(1)
			conn, _, err := w.(http.Hijacker).Hijack()
			if err != nil {
				t.Errorf("failed to hijack the connection: %s", err)
				return
			}
			_ = conn.Close()
		}))
		defer upstream.Close()

		rr := callExportHandler(http.MethodGet, exportTarget, exportPluginContext(upstream.URL, `{}`))

		if rr.Code == http.StatusOK {
			t.Fatalf("expected an error status, body %s", rr.Body.String())
		}
		if got := requests.Load(); got != 1 {
			t.Fatalf("got %d requests to VictoriaLogs, want 1", got)
		}
	})

	t.Run("keeps the received part when VictoriaLogs drops the connection", func(t *testing.T) {
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/csv")
			_, _ = w.Write([]byte("partial"))
			w.(http.Flusher).Flush()
			conn, _, err := w.(http.Hijacker).Hijack()
			if err != nil {
				t.Errorf("failed to hijack the connection: %s", err)
				return
			}
			_ = conn.Close()
		}))
		defer upstream.Close()

		rr := callExportHandler(http.MethodGet, exportTarget, exportPluginContext(upstream.URL, `{}`))

		if rr.Code != http.StatusOK {
			t.Fatalf("got status %d, body %s", rr.Code, rr.Body.String())
		}
		if rr.Body.String() != "partial" {
			t.Fatalf("got body %q, want %q", rr.Body.String(), "partial")
		}
	})
}

func TestVLExportLogsStreamsThroughResourceAdapter(t *testing.T) {
	chunk := bytes.Repeat([]byte("a"), exportCopyBufferBytes)
	const chunks = 3
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		for i := 0; i < chunks; i++ {
			_, _ = w.Write(chunk)
			w.(http.Flusher).Flush()
		}
	}))
	defer upstream.Close()

	var responses []*backend.CallResourceResponse
	sender := backend.CallResourceResponseSenderFunc(func(resp *backend.CallResourceResponse) error {
		responses = append(responses, resp)
		return nil
	})
	req := &backend.CallResourceRequest{
		PluginContext: exportPluginContext(upstream.URL, `{}`),
		Method:        http.MethodGet,
		Path:          "export/logs",
		URL:           strings.TrimPrefix(exportTarget, "/"),
	}

	if err := NewDatasource().CallResource(context.Background(), req, sender); err != nil {
		t.Fatalf("unexpected error: %s", err)
	}

	if len(responses) < 2 {
		t.Fatalf("got %d responses, want the body in several", len(responses))
	}
	if responses[0].Status != http.StatusOK {
		t.Fatalf("got status %d in the first response", responses[0].Status)
	}
	if got := responses[0].Headers["Content-Disposition"]; len(got) != 1 || got[0] != `attachment; filename="export.csv"` {
		t.Fatalf("unexpected Content-Disposition %v in the first response", got)
	}
	var totalBytes int
	for _, resp := range responses {
		if len(resp.Body) > exportCopyBufferBytes {
			t.Fatalf("a response carries %d bytes, more than the buffer of %d", len(resp.Body), exportCopyBufferBytes)
		}
		totalBytes += len(resp.Body)
	}
	if totalBytes != chunks*exportCopyBufferBytes {
		t.Fatalf("got %d bytes, want %d", totalBytes, chunks*exportCopyBufferBytes)
	}
}
