package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/vlcompat"
)

// minVersion is what the plugin requires of VictoriaLogs
func minVersion(t *testing.T) string {
	t.Helper()
	v, err := vlcompat.MinVersion()
	if err != nil {
		t.Fatal(err)
	}
	return v
}

// pastMin is a VictoriaLogs release older than the plugin requires
const pastMin = "v1.39.0"

// patch bumps the patch number of a release
func patch(t *testing.T, version string, by int) string {
	t.Helper()
	v, err := vlcompat.ParseVersion(version)
	if err != nil {
		t.Fatal(err)
	}
	return fmt.Sprintf("v%d.%d.%d", v.Major, v.Minor, v.Patch+by)
}

// buildinfoServer answers /select/buildinfo with the given body and status and records the request headers and query
func buildinfoServer(t *testing.T, status int, body string, gotHeaders *http.Header, gotQuery *url.Values) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/select/buildinfo", func(w http.ResponseWriter, r *http.Request) {
		if gotHeaders != nil {
			*gotHeaders = r.Header.Clone()
		}
		if gotQuery != nil {
			*gotQuery = r.URL.Query()
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	})
	mux.HandleFunc("/select/logsql/query", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	return httptest.NewServer(mux)
}

func pluginContextFor(url string) backend.PluginContext {
	return backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:                     url,
			JSONData:                []byte(`{"httpMethod":"GET","customQueryParameters":"token=secret","httpHeaderName1":"X-Tenant"}`),
			DecryptedSecureJSONData: map[string]string{"httpHeaderValue1": "42"},
		},
	}
}

func TestCheckVictoriaLogsSupport(t *testing.T) {
	ctx := context.Background()
	required := minVersion(t)
	f := func(status int, body string, want VictoriaLogsSupport, wantReason string, wantUnmet int) {
		t.Helper()
		var headers http.Header
		var query url.Values
		srv := buildinfoServer(t, status, body, &headers, &query)
		defer srv.Close()
		d := NewDatasource()
		di, err := d.getInstance(ctx, pluginContextFor(srv.URL+"/?tenant=7"))
		if err != nil {
			t.Fatal(err)
		}
		got := checkVictoriaLogsSupport(ctx, di)
		if got.Version != want.Version || got.VersionKnown != want.VersionKnown || got.Supported != want.Supported || got.MinVersion != required {
			t.Fatalf("checkVictoriaLogsSupport() = %+v, want %+v", got, want)
		}
		if query.Get("token") != "secret" || query.Get("tenant") != "7" {
			t.Fatalf("the URL query and the custom query parameters are not forwarded: %v", query)
		}
		if !strings.Contains(got.Reason, wantReason) {
			t.Fatalf("reason %q does not contain %q", got.Reason, wantReason)
		}
		if len(got.Unmet) != wantUnmet {
			t.Fatalf("unmet = %+v, want %d requirements", got.Unmet, wantUnmet)
		}
		if headers.Get("X-Tenant") != "42" {
			t.Fatalf("custom headers are not forwarded: %v", headers)
		}
	}
	all := len(vlcompat.Requirements)
	newer := patch(t, required, 1) + "-enterprise"
	f(http.StatusOK, `{"status":"success","data":{"version":"`+required+`"}}`, VictoriaLogsSupport{Version: required, VersionKnown: true, Supported: true}, "", 0)
	f(http.StatusOK, `{"status":"success","data":{"version":"`+newer+`"}}`, VictoriaLogsSupport{Version: newer, VersionKnown: true, Supported: true}, "", 0)
	f(http.StatusOK, `{"status":"success","data":{"version":"`+pastMin+`"}}`, VictoriaLogsSupport{Version: pastMin, VersionKnown: true, Supported: false}, "older than", all)
	// VictoriaLogs answers unknown paths with 200 and a text body
	f(http.StatusOK, `unsupported path requested: /select/buildinfo`, VictoriaLogsSupport{Version: "", Supported: false}, "unknown", all)
	f(http.StatusNotFound, `not found`, VictoriaLogsSupport{Version: "", Supported: false}, "unknown", all)
	f(http.StatusOK, `{"status":"success","data":{"version":"victoria-logs-20261105-heads-master"}}`, VictoriaLogsSupport{Version: "victoria-logs-20261105-heads-master", Supported: false}, "unknown", all)
}

func TestCheckHealthReportsVictoriaLogsSupport(t *testing.T) {
	ctx := context.Background()
	f := func(body string, wantStatus backend.HealthStatus, wantMessage string) {
		t.Helper()
		srv := buildinfoServer(t, http.StatusOK, body, nil, nil)
		defer srv.Close()
		d := NewDatasource()
		res, err := d.CheckHealth(ctx, &backend.CheckHealthRequest{PluginContext: pluginContextFor(srv.URL)})
		if err != nil {
			t.Fatal(err)
		}
		if res.Status != wantStatus || !strings.Contains(res.Message, wantMessage) {
			t.Fatalf("CheckHealth() = %v %q, want %v containing %q", res.Status, res.Message, wantStatus, wantMessage)
		}
	}
	required := minVersion(t)
	f(`{"status":"success","data":{"version":"`+required+`"}}`, backend.HealthStatusOk, "Data source is working. VictoriaLogs "+required)
	f(`{"status":"success","data":{"version":"`+pastMin+`"}}`, backend.HealthStatusError, "VictoriaLogs "+pastMin+" is older than "+required)
	// a hidden version does not fail the test query that just passed; it is reported as a warning
	f(`unsupported path requested: /select/buildinfo`, backend.HealthStatusOk, "Data source is working, but the VictoriaLogs version is unknown")
	f(`{"status":"success","data":{"version":"victoria-logs-20261105-heads-master"}}`, backend.HealthStatusOk, "may not work")
}

type resourceSender struct {
	status int
	body   []byte
}

func (s *resourceSender) Send(r *backend.CallResourceResponse) error {
	s.status = r.Status
	s.body = append(s.body, r.Body...)
	return nil
}

func TestVictoriaLogsSupportResource(t *testing.T) {
	ctx := context.Background()
	srv := buildinfoServer(t, http.StatusOK, `{"status":"success","data":{"version":"`+pastMin+`"}}`, nil, nil)
	defer srv.Close()
	d := NewDatasource()
	sender := &resourceSender{}
	err := d.CallResource(ctx, &backend.CallResourceRequest{PluginContext: pluginContextFor(srv.URL), Path: "victorialogs/support", Method: http.MethodGet}, sender)
	if err != nil {
		t.Fatal(err)
	}
	if sender.status != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", sender.status, sender.body)
	}
	var got VictoriaLogsSupport
	if err := json.Unmarshal(sender.body, &got); err != nil {
		t.Fatalf("body %s: %s", sender.body, err)
	}
	required := minVersion(t)
	want := VictoriaLogsSupport{
		Version:      pastMin,
		VersionKnown: true,
		MinVersion:   required,
		Reason:       "VictoriaLogs " + pastMin + " is older than " + required,
		Unmet:        vlcompat.Requirements,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("body = %+v, want %+v", got, want)
	}
}
