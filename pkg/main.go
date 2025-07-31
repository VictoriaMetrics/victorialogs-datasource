package main

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/plugin"
)

// VL_PLUGIN_ID describes plugin name that matches Grafana plugin naming convention
const VL_PLUGIN_ID = "victoriametrics-logs-datasource"

func main() {
	backend.SetupPluginEnvironment(VL_PLUGIN_ID)

	pluginLogger := log.New()
	ds := plugin.NewDatasource()

	pluginLogger.Info("Starting VL datasource")

	err := backend.Manage(VL_PLUGIN_ID, backend.ServeOpts{
		CallResourceHandler: ds,
		QueryDataHandler:    ds,
		CheckHealthHandler:  ds,
		StreamHandler:       ds,
	})
	if err != nil {
		pluginLogger.Error("Error starting VL datasource", "error", err.Error())
	}
}
