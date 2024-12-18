//go:build mage
// +build mage

package main

import (
	// mage:import
	"github.com/grafana/grafana-plugin-sdk-go/build"
)

// Default configures the default target.
var Default = build.BuildAll
