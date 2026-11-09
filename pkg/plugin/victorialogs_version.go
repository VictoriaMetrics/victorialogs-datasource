package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/vlcompat"
)

const buildinfoPath = "/select/buildinfo"

// VictoriaLogsSupport tells whether the VictoriaLogs behind the datasource is one this plugin version works with
type VictoriaLogsSupport struct {
	// Version as VictoriaLogs reports it; empty when it could not be obtained
	Version string `json:"version"`
	// VersionKnown tells whether Version names a release the requirements were matched against
	VersionKnown bool `json:"versionKnown"`
	// MinVersion is the oldest VictoriaLogs release that meets every requirement of the plugin
	MinVersion string `json:"minVersion"`
	Supported  bool   `json:"supported"`
	// Reason tells why the version is not supported
	Reason string `json:"reason,omitempty"`
	// Unmet lists the requirements the VictoriaLogs does not meet; every requirement when its version is unknown
	Unmet []vlcompat.Requirement `json:"unmet,omitempty"`
}

// checkVictoriaLogsSupport asks VictoriaLogs for its version and matches it against the plugin
// requirements; a version it does not report or the plugin cannot read counts as unsupported
func checkVictoriaLogsSupport(ctx context.Context, di *DatasourceInstance) VictoriaLogsSupport {
	support := VictoriaLogsSupport{}
	minVersion, err := vlcompat.MinVersion()
	if err != nil {
		support.Reason = fmt.Sprintf("invalid plugin requirements: %s", err)
		support.Unmet = vlcompat.Requirements
		return support
	}
	support.MinVersion = minVersion
	version, err := fetchVictoriaLogsVersion(ctx, di)
	if err != nil {
		support.Reason = fmt.Sprintf("VictoriaLogs version is unknown: %s", err)
		support.Unmet = vlcompat.Requirements
		return support
	}
	support.Version = version
	unmet, err := vlcompat.Unmet(version)
	if err != nil {
		support.Reason = fmt.Sprintf("VictoriaLogs version is unknown: %s", err)
		support.Unmet = vlcompat.Requirements
		return support
	}
	support.VersionKnown = true
	if len(unmet) > 0 {
		support.Reason = fmt.Sprintf("VictoriaLogs %s is older than %s", version, minVersion)
		support.Unmet = unmet
		return support
	}
	support.Supported = true
	return support
}

// fetchVictoriaLogsVersion reads the version from /select/buildinfo
func fetchVictoriaLogsVersion(ctx context.Context, di *DatasourceInstance) (string, error) {
	u, err := url.Parse(strings.TrimRight(di.settings.URL, "/"))
	if err != nil {
		return "", fmt.Errorf("failed to parse datasource URL: %w", err)
	}
	u.Path = path.Join(u.Path, buildinfoPath)
	// the query of the datasource URL and its custom query parameters may carry what a proxy authorizes by
	params, err := url.ParseQuery(di.grafanaSettings.QueryParams)
	if err != nil {
		return "", fmt.Errorf("failed to parse query params: %w", err)
	}
	values := u.Query()
	for k, vl := range params {
		for _, v := range vl {
			values.Add(k, v)
		}
	}
	u.RawQuery = values.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", fmt.Errorf("could not create request: %w", err)
	}
	req.Header = di.grafanaSettings.CustomHeaders.Clone()

	resp, err := di.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("request error: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("got response code %d from %s", resp.StatusCode, buildinfoPath)
	}
	// VictoriaLogs answers paths it does not know with 200 and a text body
	var buildinfo struct {
		Data struct {
			Version string `json:"version"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &buildinfo); err != nil {
		return "", fmt.Errorf("unexpected response from %s: %q", buildinfoPath, strings.TrimSpace(string(body)))
	}
	if buildinfo.Data.Version == "" {
		return "", fmt.Errorf("%s reports no version", buildinfoPath)
	}
	return buildinfo.Data.Version, nil
}

// VictoriaLogsSupportHandler answers the resource call of the query editor with the support of the datasource
func (d *Datasource) VictoriaLogsSupportHandler(rw http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	di, err := d.getInstance(ctx, backend.PluginConfigFromContext(ctx))
	if err != nil {
		d.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}
	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(rw).Encode(checkVictoriaLogsSupport(ctx, di)); err != nil {
		d.logger.Warn("Error writing response", "err", err.Error())
	}
}
