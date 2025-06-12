package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
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
	health          = "/health"
	httpHeaderName  = "httpHeaderName"
	httpHeaderValue = "httpHeaderValue"
	// it is weird logic to pass an identifier for an alert request in the headers
	// but Grafana decided to do so, so we need to follow this
	requestFromAlert = "FromAlert"
)

// NewDatasource creates a new datasource instance.
func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {

	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("error create httpclient.Options based on settings: %w", err)
	}
	opts.ForwardHTTPHeaders = true
	for key := range opts.Header {
		if key == "" {
			opts.Header.Del(key)
		}
	}

	cl, err := httpclient.New(opts)
	if err != nil {
		return nil, fmt.Errorf("error create a new http.Client: %w", err)
	}

	grafanaSettings, err := NewGrafanaSettings(settings)
	if err != nil {
		return nil, fmt.Errorf("error create a new GrafanaSettings: %w", err)
	}

	return &Datasource{
		settings:          settings,
		httpClient:        cl,
		liveModeResponses: sync.Map{},
		grafanaSettings:   grafanaSettings,
	}, nil
}

// GrafanaSettings contains the raw DataSourceConfig as JSON as stored by Grafana server.
// It repeats the properties in this object and includes custom properties.
type GrafanaSettings struct {
	HTTPMethod           string            `json:"httpMethod"`
	QueryParams          string            `json:"customQueryParameters"`
	CustomHeaders        http.Header       `json:"-"`
	MultitenancyHeaders  map[string]string `json:"multitenancyHeaders"`
}

func NewGrafanaSettings(settings backend.DataSourceInstanceSettings) (*GrafanaSettings, error) {
	customHttpHeaders, err := parseCustomHeaders(settings.JSONData, settings.DecryptedSecureJSONData)
	if err != nil {
		return nil, fmt.Errorf("error parse custom headers: %w", err)
	}

	var grafanaSettings GrafanaSettings
	if err := json.Unmarshal(settings.JSONData, &grafanaSettings); err != nil {
		return nil, fmt.Errorf("failed to parse datasource settings: %w", err)
	}

	// Merge multitenancy headers into the common CustomHeaders set,
	// so we don't have to attach them repeatedly for every request.
	for k, v := range grafanaSettings.MultitenancyHeaders {
		if v != "" {
			customHttpHeaders.Set(k, v)
		}
	}

	grafanaSettings.CustomHeaders = customHttpHeaders

	if grafanaSettings.HTTPMethod == "" {
		grafanaSettings.HTTPMethod = http.MethodPost
	}
	return &grafanaSettings, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct {
	settings backend.DataSourceInstanceSettings

	httpClient        *http.Client
	liveModeResponses sync.Map
	grafanaSettings   *GrafanaSettings
}

// SubscribeStream called when a user tries to subscribe to a plugin/datasource
// managed channel path – thus plugin can check subscribe permissions and communicate
// options with Grafana Core. As soon as first subscriber joins channel RunStream
// will be called.
func (d *Datasource) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	ch := make(chan *data.Frame, 1)
	d.liveModeResponses.Store(req.Path, ch)

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
	// request.Path is created in the frontend. Please check this function in the frontend
	// runLiveQueryThroughBackend where the path is created.
	// path: `${request.requestId}/${query.refId}`
	ch, ok := d.liveModeResponses.Load(request.Path)
	if !ok {
		return fmt.Errorf("failed to find the channel for the query: %s", request.Path)
	}

	livestream := ch.(chan *data.Frame)

	go func() {
		prev := data.FrameJSONCache{}
		var err error
		for frame := range livestream {
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
					backend.Logger.Debug("Client has canceled the request")
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
	// close all channels before clear the map
	d.liveModeResponses.Range(func(key, value interface{}) bool {
		ch := value.(chan *data.Frame)
		close(ch)
		return true
	})
	// clear the map
	d.liveModeResponses.Clear()
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	headers := req.Headers

	forAlerting, err := d.checkAlertingRequest(headers)
	if err != nil {
		return nil, err
	}

	var wg sync.WaitGroup
	for _, q := range req.Queries {
		rawQuery, err := d.getQueryFromRaw(q.JSON, forAlerting)
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
	q, err := d.getQueryFromRaw(request.Data, false)
	if err != nil {
		return err
	}

	r, err := d.datasourceQuery(ctx, q, true)
	if err != nil {
		return err
	}

	defer func() {
		if err := r.Close(); err != nil {
			backend.Logger.Error("failed to close response body", "err", err.Error())
		}
	}()

	ch, ok := d.liveModeResponses.Load(request.Path)
	if !ok {
		return fmt.Errorf("failed to find the channel for the query: %s", request.Path)
	}

	livestream := ch.(chan *data.Frame)
	return parseStreamResponse(r, livestream)
}

// getQueryFromRaw parses the query json from the raw message.
func (d *Datasource) getQueryFromRaw(data json.RawMessage, forAlerting bool) (*Query, error) {
	var q Query
	if err := json.Unmarshal(data, &q); err != nil {
		return nil, fmt.Errorf("failed to parse query json: %s", err)
	}
	q.ForAlerting = forAlerting
	return &q, nil
}

// datasourceQuery process the query to the datasource and returns the result.
func (d *Datasource) datasourceQuery(ctx context.Context, q *Query, isStream bool) (io.ReadCloser, error) {
	reqURL, err := q.getQueryURL(d.settings.URL, d.grafanaSettings.QueryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create request URL: %w", err)
	}

	if isStream {
		reqURL, err = q.queryTailURL(d.settings.URL, d.grafanaSettings.QueryParams)
		if err != nil {
			return nil, fmt.Errorf("failed to create request URL: %w", err)
		}
	}

	req, err := http.NewRequestWithContext(ctx, d.grafanaSettings.HTTPMethod, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create new request with context: %w", err)
	}
	req.Header = d.grafanaSettings.CustomHeaders.Clone()

	resp, err := d.httpClient.Do(req)
	if err != nil {
		if !isTrivialError(err) {
			// Return unexpected error to the caller.
			return nil, err
		}

		// Something in the middle between client and datasource might be closing
		// the connection. So we do a one more attempt in hope request will succeed.
		req, err = http.NewRequestWithContext(ctx, d.grafanaSettings.HTTPMethod, reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create new request with context: %w", err)
		}

		req.Header = d.grafanaSettings.CustomHeaders.Clone()
		resp, err = d.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to make http request: %w", err)
		}
	}

	if resp.StatusCode != http.StatusOK {
		switch resp.StatusCode {
		case http.StatusUnprocessableEntity:
			return nil, parseErrorResponse(resp.Body)
		case http.StatusBadRequest:
			return nil, parseStringResponseError(resp.Body)
		default:
			return nil, fmt.Errorf("failed to make http request: %d", resp.StatusCode)
		}
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
			backend.Logger.Error("failed to close response body", "err", err.Error())
		}
	}()

	switch q.QueryType {
	case QueryTypeStats:
		return parseStatsResponse(r, q)
	case QueryTypeStatsRange:
		return parseStatsResponse(r, q)
	case QueryTypeHits:
		return parseHitsResponse(r)
	default:
		return parseInstantResponse(r)
	}
}

func (d *Datasource) checkAlertingRequest(headers map[string]string) (bool, error) {
	var forAlerting bool
	if val, ok := headers[requestFromAlert]; ok {
		if val == "" {
			return false, nil
		}

		boolValue, err := strconv.ParseBool(val)
		if err != nil {
			return false, fmt.Errorf("failed to parse %s header value: %s", requestFromAlert, val)
		}

		forAlerting = boolValue
	}
	return forAlerting, nil
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

func parseCustomHeaders(jsonData json.RawMessage, decryptedSecureJSONData map[string]string) (http.Header, error) {
	var headersSettings map[string]json.RawMessage
	if err := json.Unmarshal(jsonData, &headersSettings); err != nil {
		return nil, fmt.Errorf("failed to parse datasource settings: %w", err)
	}

	headers := http.Header{}
	for k, v := range headersSettings {
		if !strings.HasPrefix(k, httpHeaderName) {
			continue
		}
		var headerName string
		if err := json.Unmarshal(v, &headerName); err != nil {
			return nil, fmt.Errorf("failed to parse header value: %w", err)
		}
		if len(headerName) == 0 {
			continue
		}
		headerValueName := strings.Replace(k, httpHeaderName, httpHeaderValue, 1)
		if headerValue, ok := decryptedSecureJSONData[headerValueName]; ok {
			headers.Add(headerName, headerValue)
		}
	}
	return headers, nil
}
