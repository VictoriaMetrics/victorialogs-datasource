// Command readme-compat writes the VictoriaLogs compatibility table of README.md and the
// required version of the plugin page (src/README.md) from pkg/vlcompat.Requirements.
// Run it from the repository root with `make readme-compat`
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/vlcompat"
)

// section is a marked part of a markdown file the command rewrites
type section struct {
	path    string
	name    string
	content func() (string, error)
}

var sections = []section{
	{path: "README.md", name: "table", content: func() (string, error) { return vlcompat.Table(), nil }},
	{path: "src/README.md", name: "min-version", content: vlcompat.MinVersionNote},
}

func main() {
	if err := run(".", sections); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// update is a document whose section changed, ready to be written
type update struct {
	path    string
	content []byte
}

// run rewrites every section under root and reports the files it changed; nothing is written
// until every section has been rewritten, so a failing one leaves all the files as they were
func run(root string, sections []section) error {
	var updates []update
	for _, s := range sections {
		path := filepath.Join(root, s.path)
		content, err := s.content()
		if err != nil {
			return fmt.Errorf("%s: %w", s.path, err)
		}
		doc, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		updated, err := vlcompat.ReplaceSection(string(doc), s.name, content)
		if err != nil {
			return fmt.Errorf("%s: %w", s.path, err)
		}
		if updated == string(doc) {
			continue
		}
		updates = append(updates, update{path: path, content: []byte(updated)})
	}
	for _, u := range updates {
		if err := os.WriteFile(u.path, u.content, 0o644); err != nil {
			return err
		}
		fmt.Println("updated", u.path)
	}
	return nil
}
