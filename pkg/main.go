package main

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/plugin"
)

// VL_PLUGIN_ID describes plugin name that matches Grafana plugin naming convention
const VL_PLUGIN_ID = "victoriametrics-logs-datasource"

func main() {
	backend.SetupPluginEnvironment(VL_PLUGIN_ID)

	pluginLogger := log.New()
	mux := http.NewServeMux()
	ds := Init(mux)
	httpResourceHandler := httpadapter.New(mux)

	pluginLogger.Debug("Starting VL datasource")

	err := backend.Manage(VL_PLUGIN_ID, backend.ServeOpts{
		CallResourceHandler: httpResourceHandler,
		QueryDataHandler:    ds,
		CheckHealthHandler:  ds,
		StreamHandler:       ds,
	})
	if err != nil {
		pluginLogger.Error("Error starting VL datasource", "error", err.Error())
	}
}

// Init initializes VL datasource plugin service
func Init(mux *http.ServeMux) *plugin.Datasource {
	ds := plugin.NewDatasource()

	mux.HandleFunc("/", ds.RootHandler)
	mux.HandleFunc("/select/logsql/field_values", ds.VLAPIQuery)
	mux.HandleFunc("/select/logsql/field_names", ds.VLAPIQuery)

	return ds
}
