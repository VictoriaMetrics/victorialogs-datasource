package plugin

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var (
	_ backend.StreamHandler         = &Datasource{}
	_ backend.QueryDataHandler      = &Datasource{}
	_ backend.CheckHealthHandler    = &Datasource{}
	_ instancemgmt.InstanceDisposer = &DatasourceInstance{}
)

const (
	health          = "/health"
	httpHeaderName  = "httpHeaderName"
	httpHeaderValue = "httpHeaderValue"
	// it is weird logic to pass an identifier for an alert request in the headers
	// but Grafana decided to do so, so we need to follow this
	requestFromAlert = "FromAlert"
)

// Datasource describes a plugin service that manages DatasourceInstance entities
type Datasource struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
	backend.CallResourceHandler
}

// NewDatasource creates a new datasource instance.
func NewDatasource() *Datasource {
	var ds Datasource
	ds.im = datasource.NewInstanceManager(newDatasourceInstance)
	ds.logger = log.New()

	mux := http.NewServeMux()
	mux.HandleFunc("/", ds.RootHandler)
	mux.HandleFunc("/select/logsql/field_values", ds.VLAPIQuery)
	mux.HandleFunc("/select/logsql/field_names", ds.VLAPIQuery)
	mux.HandleFunc("/select/logsql/streams", ds.VLAPIQuery)
	mux.HandleFunc("/select/logsql/stream_field_names", ds.VLAPIQuery)
	mux.HandleFunc("/select/logsql/stream_field_values", ds.VLAPIQuery)
	mux.HandleFunc("/vmui", ds.VMUIQuery)
	ds.CallResourceHandler = httpadapter.New(mux)
	return &ds
}

// newDatasourceInstance returns an initialized VM datasource instance
func newDatasourceInstance(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	logger := log.New()
	logger.Debug("Initializing new data source instance")

	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		logger.Error("Error parsing VL settings", "error", err)
		return nil, err
	}
	opts.ForwardHTTPHeaders = true
	for key := range opts.Header {
		if key == "" {
			opts.Header.Del(key)
		}
	}

	cl, err := httpclient.New(opts)
	if err != nil {
		logger.Error("error initializing HTTP client", "error", err)
		return nil, err
	}

	opts.Timeouts.Timeout = 0
	strCl, err := httpclient.New(opts)
	if err != nil {
		logger.Error("error initializing HTTP client", "error", err)
		return nil, err
	}

	var dstSettings DataSourceInstanceSettings
	if dstSettings, err = buildDatasourceSettings(settings); err != nil {
		return nil, fmt.Errorf("failed to copy datasource settings: %w", err)
	}

	if err := setVmuiURL(&dstSettings); err != nil {
		return nil, fmt.Errorf("failed to set vmui url: %w", err)
	}

	grafanaSettings, err := NewGrafanaSettings(settings)
	if err != nil {
		logger.Error("error create a new GrafanaSettings: %w", err)
		return nil, err
	}

	return &DatasourceInstance{
		settings:            dstSettings,
		httpClient:          cl,
		httpStreamingClient: strCl,
		grafanaSettings:     grafanaSettings,
	}, nil
}

// GrafanaSettings contains the raw DataSourceConfig as JSON as stored by Grafana server.
// It repeats the properties in this object and includes custom properties.
type GrafanaSettings struct {
	HTTPMethod          string            `json:"httpMethod"`
	QueryParams         string            `json:"customQueryParameters"`
	CustomHeaders       http.Header       `json:"-"`
	MultitenancyHeaders map[string]string `json:"multitenancyHeaders"`
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
		grafanaSettings.HTTPMethod = http.MethodGet
	}
	return &grafanaSettings, nil
}

// DatasourceInstance is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type DatasourceInstance struct {
	settings DataSourceInstanceSettings

	httpClient          *http.Client
	httpStreamingClient *http.Client
	grafanaSettings     *GrafanaSettings
	liveModeResponses   sync.Map
}

type DataSourceInstanceSettings struct {
	// URL is the configured URL of a data source instance (e.g. the URL of an API endpoint).
	URL string `json:"URL,omitempty"`

	// VMUIURL specifies the URL for the VictoriaMetrics UI, derived from the data source's base URL if not explicitly set.
	VMUIURL string `json:"vmuiUrl,omitempty"`
}

// SubscribeStream called when a user tries to subscribe to a plugin/datasource
// managed channel path – thus plugin can check subscribe permissions and communicate
// options with Grafana Core. As soon as first subscriber joins channel RunStream
// will be called.
func (d *Datasource) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	di, err := d.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	ch := make(chan *data.Frame, 1)
	di.liveModeResponses.Store(req.Path, ch)
	return &backend.SubscribeStreamResponse{
		Status: backend.SubscribeStreamStatusOK,
	}, nil
}

// getInstance Returns cached datasource or creates new one
func (d *Datasource) getInstance(ctx context.Context, pluginContext backend.PluginContext) (*DatasourceInstance, error) {
	instance, err := d.im.Get(ctx, pluginContext)
	if err != nil {
		return nil, err
	}
	return instance.(*DatasourceInstance), nil
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
func (d *Datasource) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	di, err := d.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}
	// request.Path is created in the frontend. Please check this function in the frontend
	// runLiveQueryThroughBackend where the path is created.
	// path: `${request.requestId}/${query.refId}`
	ch, ok := di.liveModeResponses.Load(req.Path)
	if !ok {
		return fmt.Errorf("failed to find the channel for the query: %s", req.Path)
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

	if err := di.streamQuery(ctx, req); err != nil {
		return fmt.Errorf("failed to parse stream response: %w", err)
	}

	return nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (di *DatasourceInstance) Dispose() {
	// Clean up datasource instance resources.
	di.httpClient.CloseIdleConnections()
	di.httpStreamingClient.CloseIdleConnections()
	// close all channels before clear the map
	di.liveModeResponses.Range(func(key, value interface{}) bool {
		ch := value.(chan *data.Frame)
		close(ch)
		return true
	})
	// clear the map
	di.liveModeResponses.Clear()
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	headers := req.Headers

	di, err := d.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	forAlerting, err := checkAlertingRequest(headers)
	if err != nil {
		return nil, err
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	for _, q := range req.Queries {
		rawQuery, err := getQueryFromRaw(q.JSON, forAlerting)
		if err != nil {
			return nil, err
		}
		rawQuery.DataQuery = q

		wg.Add(1)
		go func(rawQuery *Query) {
			defer wg.Done()
			resp := di.query(ctx, rawQuery)
			mu.Lock()
			response.Responses[rawQuery.RefID] = resp
			mu.Unlock()
		}(rawQuery)
	}
	wg.Wait()

	return response, nil
}

// streamQuery sends a query to the datasource and parse the tail results.
func (di *DatasourceInstance) streamQuery(ctx context.Context, request *backend.RunStreamRequest) error {
	q, err := getQueryFromRaw(request.Data, false)
	if err != nil {
		return err
	}

	r, err := di.datasourceQuery(ctx, q, true)
	if err != nil {
		return err
	}

	if r == nil {
		// VictoriaLogs returned no data
		return nil
	}

	defer func() {
		if err := r.Close(); err != nil {
			backend.Logger.Error("failed to close response body", "err", err.Error())
		}
	}()

	ch, ok := di.liveModeResponses.Load(request.Path)
	if !ok {
		return fmt.Errorf("failed to find the channel for the query: %s", request.Path)
	}

	livestream := ch.(chan *data.Frame)
	return parseStreamResponse(r, livestream)
}

// getQueryFromRaw parses the query json from the raw message.
func getQueryFromRaw(data json.RawMessage, forAlerting bool) (*Query, error) {
	var q Query
	if err := json.Unmarshal(data, &q); err != nil {
		return nil, fmt.Errorf("failed to parse query json: %s", err)
	}
	q.ForAlerting = forAlerting
	return &q, nil
}

// datasourceQuery process the query to the datasource and returns the result.
func (di *DatasourceInstance) datasourceQuery(ctx context.Context, q *Query, isStream bool) (io.ReadCloser, error) {
	reqURL, err := q.getQueryURL(di.settings.URL, di.grafanaSettings.QueryParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create request URL: %w", err)
	}

	var client *http.Client
	if isStream {
		client = di.httpStreamingClient
		reqURL, err = q.queryTailURL(di.settings.URL, di.grafanaSettings.QueryParams)
		if err != nil {
			return nil, fmt.Errorf("failed to create request URL: %w", err)
		}
	} else {
		client = di.httpClient
	}

	req, err := http.NewRequestWithContext(ctx, di.grafanaSettings.HTTPMethod, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create new request with context: %w", err)
	}
	req.Header = di.grafanaSettings.CustomHeaders.Clone()

	resp, err := client.Do(req)
	if err != nil {
		if !isTrivialError(err) {
			// Return unexpected error to the caller.
			return nil, err
		}

		// Something in the middle between client and datasource might be closing
		// the connection. So we do a one more attempt in hope request will succeed.
		req, err = http.NewRequestWithContext(ctx, di.grafanaSettings.HTTPMethod, reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create new request with context: %w", err)
		}

		req.Header = di.grafanaSettings.CustomHeaders.Clone()
		resp, err = client.Do(req)
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

	// This is to handle cases where VictoriaLogs returns no data
	// and avoid json decoding errors
	if resp.ContentLength == 0 {
		return nil, nil
	}

	return resp.Body, nil
}

// query sends a query to the datasource and returns the result.
func (di *DatasourceInstance) query(ctx context.Context, q *Query) backend.DataResponse {
	r, err := di.datasourceQuery(ctx, q, false)
	if err != nil {
		return newResponseError(err, backend.StatusInternal)
	}

	if r == nil {
		// VictoriaLogs returned no data
		return backend.DataResponse{Frames: data.Frames{}}
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

func checkAlertingRequest(headers map[string]string) (bool, error) {
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
func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}
	di, err := d.getInstance(ctx, req.PluginContext)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Error getting datasource instance"
		d.logger.Error("Error getting datasource instance", "err", err)
		return res, nil
	}
	r, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s%s", strings.TrimRight(di.settings.URL, "/"), health), nil)
	if err != nil {
		return newHealthCheckErrorf("could not create request"), nil
	}
	resp, err := di.httpClient.Do(r)
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

// RootHandler returns generic response to unsupported paths
func (d *Datasource) RootHandler(rw http.ResponseWriter, req *http.Request) {
	d.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	_, err := rw.Write([]byte("Hello from VM data source!"))
	if err != nil {
		d.logger.Warn("Error writing response")
	}

	rw.WriteHeader(http.StatusOK)
}

// VLAPIQuery performs request to VL API endpoints that doesn't return frames
func (d *Datasource) VLAPIQuery(rw http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	pluginCxt := backend.PluginConfigFromContext(ctx)

	fieldsQuery, err := getFieldsQueryFromRaw(req.Body)
	if err != nil {
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	defer func() {
		if err := req.Body.Close(); err != nil {
			d.logger.Error("VLAPIQuery: failed to close request body", "err", err.Error())
		}
	}()

	di, err := d.getInstance(ctx, pluginCxt)
	if err != nil {
		d.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	u, err := url.Parse(di.settings.URL)
	if err != nil {
		writeError(rw, http.StatusBadRequest, fmt.Errorf("failed to parse datasource url: %w", err))
		return
	}
	u.Path = path.Join(u.Path, req.URL.Path)
	u.RawQuery = fieldsQuery.queryParams().Encode()
	newReq, err := http.NewRequestWithContext(ctx, req.Method, u.String(), nil)
	if err != nil {
		writeError(rw, http.StatusBadRequest, fmt.Errorf("failed to create new request with context: %w", err))
		return
	}

	newReq.Header = di.grafanaSettings.CustomHeaders.Clone()
	resp, err := di.httpClient.Do(newReq)
	if err != nil {
		if !isTrivialError(err) {
			// Return unexpected error to the caller.
			writeError(rw, http.StatusBadRequest, err)
			return
		}

		newReq, err := http.NewRequestWithContext(ctx, req.Method, u.String(), nil)
		if err != nil {
			writeError(rw, http.StatusBadRequest, fmt.Errorf("failed to create new request with context: %w", err))
			return
		}

		// Something in the middle between client and datasource might be closing
		// the connection. So we do a one more attempt in hope request will succeed.
		resp, err = di.httpClient.Do(newReq)
		if err != nil {
			writeError(rw, http.StatusBadRequest, fmt.Errorf("failed to make http request: %w", err))
			return
		}
	}
	defer resp.Body.Close()

	reader := resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		reader, err = gzip.NewReader(reader)
		if err != nil {
			writeError(rw, http.StatusBadRequest, fmt.Errorf("failed to create gzip reader: %w", err))
			return
		}
		defer reader.Close()
	}

	bodyBytes, err := io.ReadAll(reader)
	if err != nil {
		writeError(rw, http.StatusBadRequest, fmt.Errorf("failed to read http response body: %w", err))
		return
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	_, err = rw.Write(bodyBytes)
	if err != nil {
		log.DefaultLogger.Warn("Error writing response")
	}
}

// VMUIQuery generates VMUI link to a native dashboard
func (d *Datasource) VMUIQuery(rw http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	pluginCxt := backend.PluginConfigFromContext(ctx)

	di, err := d.getInstance(ctx, pluginCxt)
	if err != nil {
		d.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	vmuiUrl, err := getBaseVMUIURL(di.settings)
	if err != nil {
		d.logger.Error("failed to build VMUI url", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	accountID := di.grafanaSettings.MultitenancyHeaders["AccountID"]
	if accountID == "" {
		accountID = "0"
	}

	projectID := di.grafanaSettings.MultitenancyHeaders["ProjectID"]
	if projectID == "" {
		projectID = "0"
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)

	if _, err := fmt.Fprintf(rw, `{"vmuiURL": %q, "accountID": %q, "projectID": %q}`,
		vmuiUrl, accountID, projectID); err != nil {
		d.logger.Warn("Error writing response", "error", err)
	}
}

func getBaseVMUIURL(settings DataSourceInstanceSettings) (string, error) {
	if len(settings.VMUIURL) > 0 {
		return settings.VMUIURL, nil
	}

	if len(settings.URL) == 0 {
		return "", fmt.Errorf("data source URL is not set")
	}

	vmuiUrl, err := newURL(settings.URL, "/select/vmui/", false)
	if err != nil {
		return "", err
	}

	return vmuiUrl.String(), nil
}

// newURL constructs a new URL by parsing the given urlStr, appending p to its path, and optionally truncating at /select/.
// Returns the resulting URL or an error if parsing fails or urlStr is empty.
func newURL(urlStr, p string, root bool) (*url.URL, error) {
	if urlStr == "" {
		return nil, fmt.Errorf("url can't be blank")
	}
	u, err := url.Parse(urlStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse datasource url: %s", err)
	}
	if root {
		if idx := strings.Index(u.Path, "/select/"); idx > 0 {
			u.Path = u.Path[:idx]
		}
	}
	u.Path = path.Join(u.Path, p)
	return u, nil
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

func writeError(rw http.ResponseWriter, statusCode int, err error) {
	data := make(map[string]interface{})

	data["error"] = "Internal Server Error"
	data["message"] = err.Error()

	var b []byte
	if b, err = json.Marshal(data); err != nil {
		rw.WriteHeader(statusCode)
		return
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusInternalServerError)

	_, err = rw.Write(b)
	if err != nil {
		log.DefaultLogger.Warn("Error writing response")
	}
}

func buildDatasourceSettings(settings backend.DataSourceInstanceSettings) (DataSourceInstanceSettings, error) {
	var dstSettings DataSourceInstanceSettings

	// get the VMUIURL from the settings
	if err := json.Unmarshal(settings.JSONData, &dstSettings); err != nil {
		return dstSettings, fmt.Errorf("failed to parse datasource JSONData settings: %w", err)
	}
	dstSettings.URL = settings.URL

	return dstSettings, nil
}

func setVmuiURL(settings *DataSourceInstanceSettings) error {
	if len(settings.VMUIURL) == 0 {
		vmuiUrl, err := newURL(settings.URL, "/select/vmui/", false)
		if err != nil {
			return fmt.Errorf("failed to build VMUI url: %w", err)
		}
		settings.VMUIURL = vmuiUrl.String()
	}

	return nil
}
