package vlcompat

import (
	"strings"
	"testing"
)

func TestTableOf(t *testing.T) {
	got := tableOf(testRequirements[:1])
	want := "| Feature | Needs | Plugin | VictoriaLogs |\n" +
		"|---|---|---|---|\n" +
		"| buildinfo | [/select/buildinfo](https://example.com/851) | v0.35.0 | v1.40.0 |\n"
	if got != want {
		t.Fatalf("tableOf() =\n%s\nwant\n%s", got, want)
	}
}

func TestTableOfEscapesPipes(t *testing.T) {
	got := tableOf([]Requirement{{Feature: "asc|desc", Needs: "a|b", Link: "l", PluginVersion: "p", MinVersion: "v"}})
	if !strings.Contains(got, `| asc\|desc | [a\|b](l) | p | v |`) {
		t.Fatalf("pipes are not escaped:\n%s", got)
	}
}

func TestMinVersionNote(t *testing.T) {
	note, err := MinVersionNote()
	if err != nil {
		t.Fatal(err)
	}
	minVersion, _ := MinVersion()
	if !strings.Contains(note, "`"+minVersion+"`") || !strings.Contains(note, CompatibilityURL) {
		t.Fatalf("note %q names neither the version nor the section", note)
	}
}

func TestReplaceSection(t *testing.T) {
	doc := "intro\n<!-- vlcompat:table:start -->\nold table\n<!-- vlcompat:table:end -->\noutro\n"
	got, err := ReplaceSection(doc, "table", "new table\n")
	if err != nil {
		t.Fatal(err)
	}
	want := "intro\n<!-- vlcompat:table:start -->\nnew table\n<!-- vlcompat:table:end -->\noutro\n"
	if got != want {
		t.Fatalf("ReplaceSection() =\n%s\nwant\n%s", got, want)
	}
	// the replacement is stable: a second run changes nothing
	again, err := ReplaceSection(got, "table", "new table\n")
	if err != nil || again != got {
		t.Fatalf("second ReplaceSection() = %q, %v", again, err)
	}
	if _, err := ReplaceSection(doc, "missing", ""); err == nil {
		t.Fatal("a missing start marker must fail")
	}
	if _, err := ReplaceSection("<!-- vlcompat:table:start -->\n", "table", ""); err == nil {
		t.Fatal("a missing end marker must fail")
	}
}
