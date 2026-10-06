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
// a marker frame is returned, without the usual retry.
func TestDatasourceQueryFirstByteTimeout(t *testing.T) {
	var calls atomic.Int32
	var headersDelay atomic.Int64
	wait := func(r *http.Request) bool {
		calls.Add(1)
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
		}
	})
	mux.HandleFunc("/select/logsql/hits", func(w http.ResponseWriter, r *http.Request) {
		if wait(r) {
			_, _ = w.Write([]byte(`{"hits":[{"fields":{},"timestamps":["2024-02-20T14:00:00Z"],"values":[1],"total":1}]}`))
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

	t.Run("logs answered within the budget pass as usual", func(t *testing.T) {
		calls.Store(0)
		headersDelay.Store(0)
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

	t.Run("hits past the budget come back as a slow marker", func(t *testing.T) {
		calls.Store(0)
		headersDelay.Store(500)
		if rsp := run(t, "hits", 50); !isSlowMarker(rsp) {
			t.Fatalf("expected the slow marker, got %+v", rsp)
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
