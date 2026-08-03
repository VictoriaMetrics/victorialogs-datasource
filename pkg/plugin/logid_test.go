package plugin

import (
	"testing"
)

func Test_buildLogID(t *testing.T) {
	ts := []byte("2024-02-20T14:04:27Z")
	labels := []byte(`{"foo":"bar"}`)

	// stability: same input produces same id
	id1 := buildLogID(ts, []byte("hello"), []byte(`{a="1"}`), labels)
	id2 := buildLogID(ts, []byte("hello"), []byte(`{a="1"}`), labels)
	if id1 != id2 {
		t.Errorf("buildLogID is not stable: %s != %s", id1, id2)
	}

	// uniqueness: differing inputs produce different ids
	cases := []struct {
		name   string
		ts     string
		msg    string
		stm    string
		labels string
	}{
		{"baseline", "2024-02-20T14:04:27Z", "hello", `{a="1"}`, `{"foo":"bar"}`},
		{"different time", "2024-02-20T14:04:27.000000001Z", "hello", `{a="1"}`, `{"foo":"bar"}`},
		{"different msg", "2024-02-20T14:04:27Z", "hello!", `{a="1"}`, `{"foo":"bar"}`},
		{"different stream", "2024-02-20T14:04:27Z", "hello", `{a="2"}`, `{"foo":"bar"}`},
		{"different labels", "2024-02-20T14:04:27Z", "hello", `{a="1"}`, `{"foo":"baz"}`},
	}
	seen := make(map[string]string, len(cases))
	for _, c := range cases {
		id := buildLogID([]byte(c.ts), []byte(c.msg), []byte(c.stm), []byte(c.labels))
		if prev, ok := seen[id]; ok {
			t.Errorf("buildLogID collision between %q and %q -> %s", prev, c.name, id)
		}
		seen[id] = c.name
	}

	// boundary safety: prefix-shifted adjacent fields must not collide
	a := buildLogID(ts, []byte("ab"), []byte("cd"), labels)
	b := buildLogID(ts, []byte("a"), []byte("bcd"), labels)
	if a == b {
		t.Errorf("buildLogID collides across msg/stream boundary: %s", a)
	}
	a = buildLogID(ts, []byte("msg"), []byte("ab"), []byte("cd"))
	b = buildLogID(ts, []byte("msg"), []byte("a"), []byte("bcd"))
	if a == b {
		t.Errorf("buildLogID collides across stream/labels boundary: %s", a)
	}
}

func Test_idBuilder(t *testing.T) {
	// repeats of the same base id get incrementing suffixes
	b := newIDBuilder()
	for i, want := range []string{"aaaa", "aaaa_1", "aaaa_2"} {
		if got := b.unique("aaaa"); got != want {
			t.Errorf("unique() call %d = %s, want %s", i+1, got, want)
		}
	}

	// a different id keeps its own independent count
	if got := b.unique("bbbb"); got != "bbbb" {
		t.Errorf("unique(bbbb) = %s, want bbbb", got)
	}

	// separate builders do not share state
	if got := newIDBuilder().unique("aaaa"); got != "aaaa" {
		t.Errorf("fresh builder unique(aaaa) = %s, want aaaa", got)
	}

	// when a new id would grow the set beyond maxSize, the set resets first
	// to keep memory bounded; counts collected so far are dropped by design
	small := &idBuilder{seen: make(map[string]int), maxSize: 2}
	small.unique("a")
	small.unique("b")
	if got := small.unique("c"); got != "c" {
		t.Errorf("unique(c) after reset = %s, want c", got)
	}
	if got := small.unique("a"); got != "a" {
		t.Errorf("unique(a) after reset = %s, want a (count dropped by reset)", got)
	}
}
