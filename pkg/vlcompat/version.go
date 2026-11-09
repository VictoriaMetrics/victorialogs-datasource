package vlcompat

import (
	"fmt"
	"regexp"
	"strconv"
)

// Version is a VictoriaLogs release number; build suffixes such as -enterprise or -cluster are dropped
type Version struct {
	Major, Minor, Patch int
}

var versionRe = regexp.MustCompile(`^v?(\d+)\.(\d+)\.(\d+)(?:[-+]|$)`)

// ParseVersion reads a release number; the full build string of an untagged build names none
func ParseVersion(s string) (Version, error) {
	m := versionRe.FindStringSubmatch(s)
	if m == nil {
		return Version{}, fmt.Errorf("%q is not a release version", s)
	}
	major, _ := strconv.Atoi(m[1])
	minor, _ := strconv.Atoi(m[2])
	patch, _ := strconv.Atoi(m[3])
	return Version{Major: major, Minor: minor, Patch: patch}, nil
}

// Before tells whether v is an older release than o
func (v Version) Before(o Version) bool {
	if v.Major != o.Major {
		return v.Major < o.Major
	}
	if v.Minor != o.Minor {
		return v.Minor < o.Minor
	}
	return v.Patch < o.Patch
}
