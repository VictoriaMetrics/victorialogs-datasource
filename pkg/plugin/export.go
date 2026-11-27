package plugin

import (
	"context"
	"fmt"
	"io"
	"math"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const (
	exportFormatJSONLines = "jsonl"
	exportFormatCSV       = "csv"

	exportCopyBufferBytes     = 256 * 1024
	exportErrorBodyLimitBytes = 4096

	minExportTimeMs = math.MinInt64 / int64(time.Millisecond)
	maxExportTimeMs = math.MaxInt64 / int64(time.Millisecond)

	exportCSVMediaType = "text/csv"
	// The response limit middleware of the plugin SDK adds 1 to the limit, so math.MaxInt64 overflows there
	exportResponseLimitBytes = math.MaxInt64 / 2
)

// exportIgnoredParams are the query args that change the content of the file.
// The datasource URL and the custom query parameters of the datasource must not set them
var exportIgnoredParams = []string{"limit", "format"}

// exportQuery is a logs export that the query editor requests
type exportQuery struct {
	Expr               string
	ExtraFilters       string
	ExtraStreamFilters string
	StartMs            int64
	EndMs              int64
	Format             string
}

// parseExportTimeMs reads a Unix timestamp in milliseconds that the export can send to VictoriaLogs in nanoseconds
func parseExportTimeMs(values url.Values, name string) (int64, error) {
	timeMs, err := strconv.ParseInt(values.Get(name), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be a Unix timestamp in milliseconds: %w", name, err)
	}
	if timeMs < minExportTimeMs || timeMs > maxExportTimeMs {
		return 0, fmt.Errorf("%s must be from %d to %d", name, minExportTimeMs, maxExportTimeMs)
	}
	return timeMs, nil
}

// parseExportQuery reads the export from the query string of the resource call.
// It ignores the args it does not know, so a caller cannot set a limit or other VictoriaLogs args
func parseExportQuery(values url.Values) (exportQuery, error) {
	expr := strings.TrimSpace(values.Get("query"))
	if expr == "" {
		return exportQuery{}, fmt.Errorf("query can't be blank")
	}
	startMs, err := parseExportTimeMs(values, "start")
	if err != nil {
		return exportQuery{}, err
	}
	endMs, err := parseExportTimeMs(values, "end")
	if err != nil {
		return exportQuery{}, err
	}
	if startMs >= endMs {
		return exportQuery{}, fmt.Errorf("start must be before end")
	}
	format := values.Get("format")
	if format != exportFormatJSONLines && format != exportFormatCSV {
		return exportQuery{}, fmt.Errorf("format must be %q or %q", exportFormatJSONLines, exportFormatCSV)
	}
	return exportQuery{
		Expr:               expr,
		ExtraFilters:       values.Get("extra_filters"),
		ExtraStreamFilters: values.Get("extra_stream_filters"),
		StartMs:            startMs,
		EndMs:              endMs,
		Format:             format,
	}, nil
}

// url builds the /select/logsql/query URL of the export. It sets no limit: the export returns every matching log
func (q exportQuery) url(datasourceURL, customQueryParams string) (string, error) {
	u, err := newURL(datasourceURL, instantQueryPath, false)
	if err != nil {
		return "", err
	}
	customParams, err := url.ParseQuery(customQueryParams)
	if err != nil {
		return "", fmt.Errorf("failed to parse query params: %w", err)
	}
	values := u.Query()
	for name, paramValues := range customParams {
		for _, value := range paramValues {
			values.Add(name, value)
		}
	}
	for _, name := range exportIgnoredParams {
		values.Del(name)
	}
	values.Set("query", q.Expr)
	values.Set("start", strconv.FormatInt(time.UnixMilli(q.StartMs).UnixNano(), 10))
	values.Set("end", strconv.FormatInt(time.UnixMilli(q.EndMs).UnixNano(), 10))
	if q.ExtraFilters != "" {
		values.Set("extra_filters", q.ExtraFilters)
	}
	if q.ExtraStreamFilters != "" {
		values.Set("extra_stream_filters", q.ExtraStreamFilters)
	}
	if q.Format == exportFormatCSV {
		values.Set("format", exportFormatCSV)
	}
	u.RawQuery = values.Encode()
	return u.String(), nil
}

// copyFlushing copies src to dst and flushes dst after every chunk.
// The resource adapter of the plugin SDK keeps the written bytes in memory until a flush
func copyFlushing(dst http.ResponseWriter, src io.Reader) error {
	flusher, canFlush := dst.(http.Flusher)
	buf := make([]byte, exportCopyBufferBytes)
	for {
		n, readErr := src.Read(buf)
		if n > 0 {
			if _, err := dst.Write(buf[:n]); err != nil {
				return fmt.Errorf("write response: %w", err)
			}
			if canFlush {
				flusher.Flush()
			}
		}
		if readErr == io.EOF {
			return nil
		}
		if readErr != nil {
			return fmt.Errorf("read response: %w", readErr)
		}
	}
}

// openExport starts the export request. It does not send the request a second time after an error:
// VictoriaLogs can still run the first one, and a query without a limit is heavy
func (di *DatasourceInstance) openExport(ctx context.Context, reqURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, di.grafanaSettings.HTTPMethod, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create new request with context: %w", withoutRequestURL(err))
	}
	req.Header = di.grafanaSettings.CustomHeaders.Clone()
	resp, err := di.httpStreamingClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make http request: %w", withoutRequestURL(err))
	}
	return resp, nil
}

func exportStatusError(resp *http.Response) error {
	body, err := io.ReadAll(io.LimitReader(resp.Body, exportErrorBodyLimitBytes))
	if err != nil {
		return fmt.Errorf("VictoriaLogs returned status %d", resp.StatusCode)
	}
	return fmt.Errorf("VictoriaLogs returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
}

// checkExportFormat fails when VictoriaLogs ignored format=csv, as the releases without the CSV format do
func checkExportFormat(resp *http.Response, format string) error {
	if format != exportFormatCSV {
		return nil
	}
	contentType := resp.Header.Get("Content-Type")
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err == nil && mediaType == exportCSVMediaType {
		return nil
	}
	return fmt.Errorf("VictoriaLogs returned %q, not CSV: this VictoriaLogs does not support the CSV format", contentType)
}

func setExportHeaders(header http.Header, upstream http.Header, format string) {
	header.Set("Content-Type", upstream.Get("Content-Type"))
	if contentEncoding := upstream.Get("Content-Encoding"); contentEncoding != "" {
		header.Set("Content-Encoding", contentEncoding)
	}
	header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="export.%s"`, format))
}

// VLExportLogs streams the full result of a logs query as a file
func (d *Datasource) VLExportLogs(rw http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(rw, "the logs export supports the GET method only", http.StatusMethodNotAllowed)
		return
	}
	ctx := httpclient.WithResponseLimit(req.Context(), exportResponseLimitBytes)
	query, err := parseExportQuery(req.URL.Query())
	if err != nil {
		writeError(rw, http.StatusBadRequest, err)
		return
	}
	di, err := d.getInstance(ctx, backend.PluginConfigFromContext(ctx))
	if err != nil {
		d.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}
	reqURL, err := query.url(di.settings.URL, di.grafanaSettings.QueryParams)
	if err != nil {
		writeError(rw, http.StatusBadRequest, err)
		return
	}
	resp, err := di.openExport(ctx, reqURL)
	if err != nil {
		writeError(rw, http.StatusBadGateway, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		statusErr := exportStatusError(resp)
		d.logger.Error("VictoriaLogs rejected the logs export", "error", statusErr)
		writeError(rw, resp.StatusCode, statusErr)
		return
	}

	if err := checkExportFormat(resp, query.Format); err != nil {
		d.logger.Error("VictoriaLogs returned the logs export in a wrong format", "error", err)
		writeError(rw, http.StatusBadGateway, err)
		return
	}

	setExportHeaders(rw.Header(), resp.Header, query.Format)
	rw.WriteHeader(http.StatusOK)
	// The browser already has the 200 status, so the interrupted file looks complete to it
	if err := copyFlushing(rw, resp.Body); err != nil && ctx.Err() == nil {
		d.logger.Error("The logs export was interrupted, the file is incomplete", "error", err)
	}
}
