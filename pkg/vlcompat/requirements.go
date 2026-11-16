// Package vlcompat lists the VictoriaLogs APIs the plugin relies on and tells which of
// them a VictoriaLogs of a given version provides. The list is the single source of the
// compatibility table in README.md and of the version check of the backend.
package vlcompat

import "fmt"

// Requirement is a VictoriaLogs API a plugin feature relies on
type Requirement struct {
	// Feature is what the plugin does with the API
	Feature string `json:"feature"`
	// Needs is the VictoriaLogs API the feature relies on
	Needs string `json:"needs"`
	// Link points to where VictoriaLogs added the API
	Link string `json:"link"`
	// PluginVersion is the plugin release that started relying on the API
	PluginVersion string `json:"pluginVersion"`
	// MinVersion is the oldest VictoriaLogs release that provides the API
	MinVersion string `json:"minVersion"`
}

// Requirements lists the APIs this plugin version relies on, in the order the README documents them.
// README.md and src/README.md are generated from it with `make readme-compat`: the pre-commit hook
// runs it and CI fails when they are stale. Texts are plain: they are shown both in markdown and in
// the query editor
var Requirements = []Requirement{
	{
		Feature:       "Compatibility check: Save & test on the data source page and the warning in the query editor",
		Needs:         "the /select/buildinfo endpoint reporting the VictoriaLogs version",
		Link:          "https://github.com/VictoriaMetrics/VictoriaLogs/pull/851",
		PluginVersion: "v0.35.0",
		MinVersion:    "v1.40.0",
	},
	{
		Feature:       "Order of raw logs: the Explore sort order, the Direction option in dashboards and the log context",
		Needs:         "the sort_direction query arg of /select/logsql/query",
		Link:          "https://github.com/VictoriaMetrics/VictoriaLogs/pull/1355",
		PluginVersion: "v0.35.0",
		MinVersion:    "v1.54.0",
	},
}

// MinVersion is the oldest VictoriaLogs release that meets every requirement
func MinVersion() (string, error) {
	return minVersionOf(Requirements)
}

func minVersionOf(requirements []Requirement) (string, error) {
	if len(requirements) == 0 {
		return "", fmt.Errorf("no VictoriaLogs requirements are listed")
	}
	newest := requirements[0]
	newestVersion, err := ParseVersion(newest.MinVersion)
	if err != nil {
		return "", fmt.Errorf("requirement %q: %w", newest.Feature, err)
	}
	for _, r := range requirements[1:] {
		v, err := ParseVersion(r.MinVersion)
		if err != nil {
			return "", fmt.Errorf("requirement %q: %w", r.Feature, err)
		}
		if newestVersion.Before(v) {
			newest, newestVersion = r, v
		}
	}
	return newest.MinVersion, nil
}

// Unmet tells which requirements a VictoriaLogs of the given version does not meet.
// The error names a version that is not a release or a requirement with an invalid minimum
func Unmet(version string) ([]Requirement, error) {
	return unmetOf(Requirements, version)
}

func unmetOf(requirements []Requirement, version string) ([]Requirement, error) {
	v, err := ParseVersion(version)
	if err != nil {
		return nil, err
	}
	var unmet []Requirement
	for _, r := range requirements {
		minimum, err := ParseVersion(r.MinVersion)
		if err != nil {
			return nil, fmt.Errorf("requirement %q: %w", r.Feature, err)
		}
		if v.Before(minimum) {
			unmet = append(unmet, r)
		}
	}
	return unmet, nil
}
