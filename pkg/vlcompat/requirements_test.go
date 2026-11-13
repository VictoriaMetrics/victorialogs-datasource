package vlcompat

import (
	"reflect"
	"testing"
)

var testRequirements = []Requirement{
	{Feature: "buildinfo", Needs: "/select/buildinfo", Link: "https://example.com/851", PluginVersion: "v0.35.0", MinVersion: "v1.40.0"},
	{Feature: "sort", Needs: "sort_direction", Link: "https://example.com/1355", PluginVersion: "v0.36.0", MinVersion: "v1.54.0"},
	{Feature: "old", Needs: "tenant_ids", Link: "https://example.com/1", PluginVersion: "v0.10.0", MinVersion: "v1.38.0"},
}

func TestRequirementsAreValid(t *testing.T) {
	if _, err := MinVersion(); err != nil {
		t.Fatal(err)
	}
	for _, r := range Requirements {
		if r.Feature == "" || r.Needs == "" || r.Link == "" || r.PluginVersion == "" {
			t.Fatalf("requirement %+v has an empty field", r)
		}
	}
}

func TestMinVersionOf(t *testing.T) {
	got, err := minVersionOf(testRequirements)
	if err != nil {
		t.Fatal(err)
	}
	if got != "v1.54.0" {
		t.Fatalf("minVersionOf() = %s, want v1.54.0", got)
	}
	if _, err := minVersionOf(nil); err == nil {
		t.Fatal("minVersionOf(nil) must fail")
	}
	if _, err := minVersionOf([]Requirement{{Feature: "broken", MinVersion: "latest"}}); err == nil {
		t.Fatal("an invalid minimum must fail")
	}
}

func TestUnmetOf(t *testing.T) {
	f := func(version string, wantFeatures ...string) {
		t.Helper()
		unmet, err := unmetOf(testRequirements, version)
		if err != nil {
			t.Fatal(err)
		}
		var got []string
		for _, r := range unmet {
			got = append(got, r.Feature)
		}
		if !reflect.DeepEqual(got, wantFeatures) {
			t.Fatalf("unmetOf(%s) = %v, want %v", version, got, wantFeatures)
		}
	}
	f("v1.54.0")
	f("v1.60.0-enterprise")
	f("v1.53.9", "sort")
	f("v1.39.0", "buildinfo", "sort")
	f("v1.37.0", "buildinfo", "sort", "old")

	if _, err := unmetOf(testRequirements, "victoria-logs-20261105-heads-master"); err == nil {
		t.Fatal("an untagged build must fail")
	}
}
