package plugin

import (
	"context"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// errSlowResponse reports a query VictoriaLogs did not start answering within its first byte timeout.
var errSlowResponse = errors.New("the datasource did not start answering within the first byte timeout")

// doWithFirstByteTimeout sends the request and gives it up when the response headers
// take longer than the timeout; reading the body is not limited. For the queries the
// frontend sends with a budget (sorted logs, hits) VictoriaLogs writes the headers only
// once the result is computed, so the budget covers the server time and nothing else.
func doWithFirstByteTimeout(client *http.Client, req *http.Request, timeout time.Duration) (*http.Response, error) {
	if timeout <= 0 {
		return client.Do(req)
	}
	ctx, cancel := context.WithCancel(req.Context())
	timer := time.AfterFunc(timeout, cancel)
	resp, err := client.Do(req.WithContext(ctx))
	if !timer.Stop() {
		// the timer fired: the context is cancelled whatever Do returned
		if err == nil {
			_ = resp.Body.Close()
		}
		return nil, errSlowResponse
	}
	if err != nil {
		cancel()
		return nil, err
	}
	resp.Body = cancelOnClose{ReadCloser: resp.Body, cancel: cancel}
	return resp, nil
}

// cancelOnClose releases the request context together with the response body.
type cancelOnClose struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (c cancelOnClose) Close() error {
	defer c.cancel()
	return c.ReadCloser.Close()
}

// slowQueryResponse is the answer to a query given up at its first byte timeout: one
// empty frame marked for the frontend, which loads the logs volume bar by bar instead.
func slowQueryResponse(q *Query) backend.DataResponse {
	var frame *data.Frame
	switch q.QueryType {
	case QueryTypeStats, QueryTypeStatsRange, QueryTypeHits:
		frame = data.NewFrame("")
	default:
		frame = newLogFrame().dataFrame
	}
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.Custom = map[string]any{"slowQuery": true}
	return backend.DataResponse{Frames: data.Frames{frame}}
}
