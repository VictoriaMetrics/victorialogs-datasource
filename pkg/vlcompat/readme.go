package vlcompat

import (
	"fmt"
	"strings"
)

// CompatibilityURL is the README section that documents the requirements
const CompatibilityURL = "https://github.com/VictoriaMetrics/victorialogs-datasource/tree/main#victorialogs-compatibility"

// Table renders the requirements as the markdown table of the README
func Table() string {
	return tableOf(Requirements)
}

func tableOf(requirements []Requirement) string {
	var b strings.Builder
	b.WriteString("| Feature | Needs | Plugin | VictoriaLogs |\n")
	b.WriteString("|---|---|---|---|\n")
	for _, r := range requirements {
		fmt.Fprintf(&b, "| %s | [%s](%s) | %s | %s |\n", cell(r.Feature), cell(r.Needs), r.Link, r.PluginVersion, r.MinVersion)
	}
	return b.String()
}

// cell escapes the pipes of a text so that it stays within its table cell
func cell(s string) string {
	return strings.ReplaceAll(s, "|", "\\|")
}

// MinVersionNote renders the sentence of the plugin page that names the required VictoriaLogs
func MinVersionNote() (string, error) {
	minVersion, err := MinVersion()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("The plugin requires VictoriaLogs `%s` or newer: see [VictoriaLogs compatibility](%s) "+
		"for what each feature needs and how the plugin reports an unsupported version.\n", minVersion, CompatibilityURL), nil
}

// ReplaceSection puts content between the `<!-- vlcompat:<name>:start -->` and
// `<!-- vlcompat:<name>:end -->` markers of a markdown document, each marker on its own line
func ReplaceSection(doc, name, content string) (string, error) {
	start := fmt.Sprintf("<!-- vlcompat:%s:start -->", name)
	end := fmt.Sprintf("<!-- vlcompat:%s:end -->", name)
	from := strings.Index(doc, start)
	if from < 0 {
		return "", fmt.Errorf("marker %s not found", start)
	}
	from += len(start)
	to := strings.Index(doc[from:], end)
	if to < 0 {
		return "", fmt.Errorf("marker %s not found", end)
	}
	return doc[:from] + "\n" + content + doc[from+to:], nil
}
