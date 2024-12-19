//go:build mage
// +build mage

package main

import (
	// mage:import
	"github.com/grafana/grafana-plugin-sdk-go/build"
)

func init() {
	build.SetBeforeBuildCallback(func(cfg build.Config) (build.Config, error) {
		// Do something before building
		cfg.OutputBinaryPath = "plugins/victoriametrics-logs-datasource"
		return cfg, nil
	})
}

// Default configures the default target.
var Default = build.BuildAll
