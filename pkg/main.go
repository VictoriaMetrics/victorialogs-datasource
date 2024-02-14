package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/plugin"
)

func main() {
	backend.Logger.Info("Starting VictoriaLogs datasource backend ...")

	if err := datasource.Manage("victorialogs-datasource-http-backend", plugin.NewDatasource, datasource.ManageOpts{}); err != nil {
		log.DefaultLogger.Error("Failed to process VictoriaLogs datasource backend: %s", err.Error())
		os.Exit(1)
	}
}
