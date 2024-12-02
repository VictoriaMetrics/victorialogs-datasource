package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var (
	_ backend.StreamHandler         = &Datasource{}
	_ backend.QueryDataHandler      = &Datasource{}
	_ backend.CheckHealthHandler    = &Datasource{}
	_ instancemgmt.InstanceDisposer = &Datasource{}
)

const (
	health = "/health"
)

// NewDatasource creates a new datasource instance.
func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("error create httpclient.Options based on settings: %w", err)
	}
	opts.ForwardHTTPHeaders = true

	cl, err := httpclient.New(opts)
	if err != nil {
		return nil, fmt.Errorf("error create a new http.Client: %w", err)
	}
	return &Datasource{
		settings:   settings,
		httpClient: cl,
		streamCh:   make(chan *data.Frame),
	}, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct {
	settings backend.DataSourceInstanceSettings

	httpClient *http.Client
	streamCh   chan *data.Frame
}

// SubscribeStream called when a user tries to subscribe to a plugin/datasource
// managed channel path – thus plugin can check subscribe permissions and communicate
// options with Grafana Core. As soon as first subscriber joins channel RunStream
// will be called.
func (d *Datasource) SubscribeStream(_ context.Context, _ *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}, nil
}

// PublishStream called when a user tries to publish to a plugin/datasource
// managed channel path.
func (d *Datasource) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

// RunStream will be
// called once for the first client successfully subscribed to a channel path.
// When Grafana detects that there are no longer any subscribers inside a channel,
// the call will be terminated until next active subscriber appears. Call termination
// can happen with a delay.
func (d *Datasource) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error {
	go func() {
		prev := data.FrameJSONCache{}
		var err error
		for frame := range d.streamCh {
			next, _ := data.FrameToJSONCache(frame)
			if next.SameSchema(&prev) {
				err = sender.SendBytes(next.Bytes(data.IncludeAll))
			} else {
				err = sender.SendFrame(frame, data.IncludeAll)
			}
			prev = next

			if err != nil {
				// TODO I can't find any of this error in the code
				// so just check the error message
				if strings.Contains(err.Error(), "rpc error: code = Canceled desc = context canceled") {
					backend.Logger.Info("Client has canceled the request")
					break
				}
				backend.Logger.Error("Failed send frame", "error", err)
			}
		}
	}()

	if err := d.streamQuery(ctx, request); err != nil {
		return fmt.Errorf("failed to parse stream response: %w", err)
	}

	return nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
	d.httpClient.CloseIdleConnections()
	close(d.streamCh)
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	var wg sync.WaitGroup
	for _, q := range req.Queries {
		rawQuery, err := d.getQueryFromRaw(q.JSON)
		if err != nil {
			return nil, err
		}
		rawQuery.DataQuery = q

		wg.Add(1)
		go func(rawQuery *Query) {
			defer wg.Done()
			response.Responses[rawQuery.RefID] = d.query(ctx, req.PluginContext, rawQuery)
		}(rawQuery)
	}
	wg.Wait()

	return response, nil
}

// streamQuery sends a query to the datasource and parse the tail results.
func (d *Datasource) streamQuery(ctx context.Context, request *backend.RunStreamRequest) error {
	q, err := d.getQueryFromRaw(request.Data)
	if err != nil {
		return err
	}

	r, err := d.datasourceQuery(ctx, q, true)
	if err != nil {
		return err
	}

	return parseStreamResponse(r, d.streamCh)
}

// getQueryFromRaw parses the query json from the raw message.
func (d *Datasource) getQueryFromRaw(data json.RawMessage) (*Query, error) {
	var q Query
	if err := json.Unmarshal(data, &q); err != nil {
		return nil, fmt.Errorf("failed to parse query json: %s", err)
	}
	return &q, nil
}

// datasourceQuery process the query to the datasource and returns the result.
func (d *Datasource) datasourceQuery(ctx context.Context, q *Query, isStream bool) (io.ReadCloser, error) {

	var settings struct {
		HTTPMethod  string `json:"httpMethod"`
		QueryParams string `json:"customQueryParameters"`
	}
	if err := json.Unmarshal(d.settings.JSONData, &settings); err != nil {
		return nil, fmt.Errorf("failed to parse datasource settings: %w", err)
	}
	if settings.HTTPMethod == "" {
		settings.HTTPMethod = http.MethodPost
	}

	reqURL, err := q.getQueryURL(d.settings.URL, settings.QueryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create request URL: %w", err)
	}

	if isStream {
		reqURL, err = q.queryTailURL(d.settings.URL, settings.QueryParams)
		if err != nil {
			return nil, fmt.Errorf("failed to create request URL: %w", err)
		}
	}

	req, err := http.NewRequestWithContext(ctx, settings.HTTPMethod, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create new request with context: %w", err)
	}
	resp, err := d.httpClient.Do(req)
	if err != nil {
		if !isTrivialError(err) {
			// Return unexpected error to the caller.
			return nil, err
		}

		// Something in the middle between client and datasource might be closing
		// the connection. So we do a one more attempt in hope request will succeed.
		req, err = http.NewRequestWithContext(ctx, settings.HTTPMethod, reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create new request with context: %w", err)
		}
		resp, err = d.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to make http request: %w", err)
		}
	}

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusUnprocessableEntity {
			return nil, parseErrorResponse(resp.Body)
		}
		return nil, fmt.Errorf("got unexpected response status code: %d", resp.StatusCode)
	}

	return resp.Body, nil
}

// query sends a query to the datasource and returns the result.
func (d *Datasource) query(ctx context.Context, _ backend.PluginContext, q *Query) backend.DataResponse {
	r, err := d.datasourceQuery(ctx, q, false)
	if err != nil {
		return newResponseError(err, backend.StatusInternal)
	}

	defer func() {
		if err := r.Close(); err != nil {
			log.DefaultLogger.Error("failed to close response body", "err", err.Error())
		}
	}()

	switch QueryType(q.QueryType) {
	case QueryTypeStats:
		return parseStatsResponse(r, q)
	case QueryTypeStatsRange:
		return parseStatsResponse(r, q)
	default:
		return parseInstantResponse(r)
	}
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	r, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s%s", strings.TrimRight(d.settings.URL, "/"), health), nil)
	if err != nil {
		return newHealthCheckErrorf("could not create request"), nil
	}
	resp, err := d.httpClient.Do(r)
	if err != nil {
		return newHealthCheckErrorf("request error"), nil
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.DefaultLogger.Error("check health: failed to close response body", "err", err.Error())
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return newHealthCheckErrorf("got response code %d", resp.StatusCode), nil
	}
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Data source is working",
	}, nil
}

// newHealthCheckErrorf returns a new *backend.CheckHealthResult with its status set to backend.HealthStatusError
// and the specified message, which is formatted with Sprintf.
func newHealthCheckErrorf(format string, args ...interface{}) *backend.CheckHealthResult {
	return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: fmt.Sprintf(format, args...)}
}

// newResponseError returns a new backend.DataResponse with its status set to backend.DataResponse
// and the specified error message.
func newResponseError(err error, httpStatus backend.Status) backend.DataResponse {
	log.DefaultLogger.Error(err.Error())
	return backend.DataResponse{Status: httpStatus, Error: err}
}

// isTrivialError returns true if the err is temporary and can be retried.
func isTrivialError(err error) bool {
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	// Suppress trivial network errors, which could occur at remote side.
	s := err.Error()
	if strings.Contains(s, "broken pipe") || strings.Contains(s, "reset by peer") {
		return true
	}
	return false
}
