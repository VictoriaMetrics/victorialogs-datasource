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

func firstByteDeadline(q *Query) time.Time {
	if q.FirstByteTimeoutMs <= 0 {
		return time.Time{}
	}
	return time.Now().Add(time.Duration(q.FirstByteTimeoutMs) * time.Millisecond)
}

// doWithFirstByteTimeout sends the request and gives it up when the response headers
// have not arrived by the deadline (zero: no deadline). The deadline covers connecting
// and the server time up to the headers; reading the body is left to the client's own
// timeout. VictoriaLogs writes the headers of sorted logs and hits queries only once the
// result is computed, so for them the budget is mostly server time.
func doWithFirstByteTimeout(client *http.Client, req *http.Request, deadline time.Time) (*http.Response, error) {
	if deadline.IsZero() {
		return client.Do(req)
	}
	ctx, cancel := context.WithCancel(req.Context())
	timer := time.AfterFunc(time.Until(deadline), cancel)
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
// The frontend reads nothing but the marker, so the frame has the same shape for every query type.
func slowQueryResponse() backend.DataResponse {
	frame := data.NewFrame("")
	frame.Meta = &data.FrameMeta{Custom: map[string]any{"slowQuery": true}}
	return backend.DataResponse{Frames: data.Frames{frame}}
}
