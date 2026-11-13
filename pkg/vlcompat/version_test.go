package vlcompat

import "testing"

func TestParseVersion(t *testing.T) {
	f := func(s string, want Version, wantErr bool) {
		t.Helper()
		got, err := ParseVersion(s)
		if (err != nil) != wantErr {
			t.Fatalf("ParseVersion(%q) error = %v, wantErr %v", s, err, wantErr)
		}
		if got != want {
			t.Fatalf("ParseVersion(%q) = %v, want %v", s, got, want)
		}
	}
	f("v1.53.0", Version{1, 53, 0}, false)
	f("1.53.0", Version{1, 53, 0}, false)
	// VictoriaLogs tags no pre-releases: a suffix names a build flavor of the release
	f("v1.54.1-enterprise", Version{1, 54, 1}, false)
	f("v1.54.1-cluster", Version{1, 54, 1}, false)
	f("v1.54.1-enterprise-cluster", Version{1, 54, 1}, false)
	// untagged builds report the full build string, which names no release
	f("victoria-logs-20261105-095010-heads-master-0-gabcdef", Version{}, true)
	f("", Version{}, true)
}

func TestVersionBefore(t *testing.T) {
	parse := func(s string) Version {
		t.Helper()
		v, err := ParseVersion(s)
		if err != nil {
			t.Fatal(err)
		}
		return v
	}
	f := func(a, b string, want bool) {
		t.Helper()
		if got := parse(a).Before(parse(b)); got != want {
			t.Fatalf("%s before %s = %v, want %v", a, b, got, want)
		}
	}
	f("v1.53.0", "v1.54.0", true)
	f("v1.54.0", "v1.54.0", false)
	f("v1.54.1", "v1.54.0", false)
	f("v2.0.0", "v1.99.9", false)
	f("v1.9.0", "v1.10.0", true)
}
