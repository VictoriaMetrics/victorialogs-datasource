package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRun(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "doc.md")
	doc := "# Doc\n\n<!-- vlcompat:note:start -->\nstale\n<!-- vlcompat:note:end -->\n"
	if err := os.WriteFile(path, []byte(doc), 0o644); err != nil {
		t.Fatal(err)
	}
	sections := []section{{path: "doc.md", name: "note", content: func() (string, error) { return "fresh\n", nil }}}
	if err := run(root, sections); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(path)
	want := "# Doc\n\n<!-- vlcompat:note:start -->\nfresh\n<!-- vlcompat:note:end -->\n"
	if string(got) != want {
		t.Fatalf("run() wrote\n%s\nwant\n%s", got, want)
	}

	missing := []section{{path: "doc.md", name: "missing", content: func() (string, error) { return "", nil }}}
	if err := run(root, missing); err == nil {
		t.Fatal("a document without the markers must fail")
	}
	if err := run(root, []section{{path: "absent.md", name: "note", content: sections[0].content}}); err == nil {
		t.Fatal("an absent document must fail")
	}
}
