package plugin

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// TestDatasourceQueryFirstByteTimeout checks the budget a query may carry for the
// time VictoriaLogs takes to start answering: past it the request is given up and
// a marker frame is returned, without the usual retry; a retry after a dropped
// connection shares the budget of the first attempt.
func TestDatasourceQueryFirstByteTimeout(t *testing.T) {
	var calls atomic.Int32
	var headersDelay atomic.Int64
	// dropAfter > 0: the next call waits that long and then drops the connection without a response
	var dropAfter atomic.Int64
	wait := func(r *http.Request) bool {
		calls.Add(1)
		if delay := dropAfter.Swap(0); delay > 0 {
			time.Sleep(time.Duration(delay) * time.Millisecond)
			return false
		}
		select {
		case <-time.After(time.Duration(headersDelay.Load()) * time.Millisecond):
			return true
		case <-r.Context().Done():
			return false
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/select/logsql/query", func(w http.ResponseWriter, r *http.Request) {
		if wait(r) {
			_, _ = w.Write([]byte(`{"_msg":"123","_stream":"{app=\"a\"}","_time":"2024-02-20T14:04:27Z"}`))
			return
		}
		if r.Context().Err() == nil {
			// dropped on purpose: close the connection so the client sees EOF and retries
			conn, _, err := w.(http.Hijacker).Hijack()
			if err == nil {
				_ = conn.Close()
			}
		}
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	d := NewDatasource()
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      srv.URL,
			JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
		},
	}
	run := func(t *testing.T, queryType string, firstByteTimeoutMs int64) backend.DataResponse {
		t.Helper()
		queryJSON, _ := json.Marshal(map[string]any{
			"expr": "*", "maxLines": 10, "queryType": queryType, "refId": "A", "firstByteTimeoutMs": firstByteTimeoutMs,
		})
		rsp, err := d.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: pluginCtx,
			Queries:       []backend.DataQuery{{RefID: "A", QueryType: queryType, JSON: queryJSON}},
		})
		if err != nil {
			t.Fatalf("unexpected error: %s", err)
		}
		return rsp.Responses["A"]
	}
	isSlowMarker := func(rsp backend.DataResponse) bool {
		if rsp.Error != nil || len(rsp.Frames) != 1 || rsp.Frames[0].Meta == nil {
			return false
		}
		custom, _ := rsp.Frames[0].Meta.Custom.(map[string]any)
		return custom["slowQuery"] == true && rsp.Frames[0].Rows() == 0
	}

	t.Run("an answer within the budget is read in full through the wrapped body", func(t *testing.T) {
		calls.Store(0)
		headersDelay.Store(50)
		rsp := run(t, "instant", 1000)
		if rsp.Error != nil || len(rsp.Frames) != 1 || rsp.Frames[0].Rows() != 1 {
			t.Fatalf("expected one logs row, got %+v", rsp)
		}
		if isSlowMarker(rsp) {
			t.Fatalf("a fast answer must not be marked slow")
		}
	})

	t.Run("logs past the budget come back as a slow marker without a retry", func(t *testing.T) {
		calls.Store(0)
		headersDelay.Store(500)
		started := time.Now()
		rsp := run(t, "instant", 50)
		if !isSlowMarker(rsp) {
			t.Fatalf("expected the slow marker, got %+v", rsp)
		}
		if elapsed := time.Since(started); elapsed > 400*time.Millisecond {
			t.Fatalf("the request was not given up at the budget, took %s", elapsed)
		}
		if got := calls.Load(); got != 1 {
			t.Fatalf("expected a single attempt, got %d", got)
		}
	})

	t.Run("the retry after a dropped connection gets the rest of the budget, not a new one", func(t *testing.T) {
		calls.Store(0)
		// the first attempt is dropped at 200 ms, the retry would need 300 ms more: 500 ms in all against a 300 ms budget
		dropAfter.Store(200)
		headersDelay.Store(300)
		started := time.Now()
		rsp := run(t, "instant", 300)
		if !isSlowMarker(rsp) {
			t.Fatalf("expected the slow marker, got %+v", rsp)
		}
		if elapsed := time.Since(started); elapsed > 450*time.Millisecond {
			t.Fatalf("the retry restarted the budget, took %s", elapsed)
		}
		if got := calls.Load(); got != 2 {
			t.Fatalf("expected the dropped attempt and one retry, got %d", got)
		}
	})

	t.Run("a query without the budget waits for the answer", func(t *testing.T) {
		calls.Store(0)
		headersDelay.Store(150)
		rsp := run(t, "instant", 0)
		if rsp.Error != nil || len(rsp.Frames) != 1 || rsp.Frames[0].Rows() != 1 {
			t.Fatalf("expected one logs row, got %+v", rsp)
		}
	})
}
