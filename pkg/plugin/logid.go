package plugin

import (
	"hash/fnv"
	"strconv"
)

const (
	idDeduperMaxSize = 100_000
)

// idBuilder builds unique log row ids: repeats of the same base id within one
// response or stream session get an incrementing `_1`, `_2`, ... suffix.
// Duplicate base ids are expected for identical rows (same time, message,
// stream and fields), and Grafana's LogList breaks on duplicate row uids
// (rows render on top of each other), so every emitted id must be unique.
type idBuilder struct {
	seen    map[string]int
	maxSize int
}

func newIDBuilder() *idBuilder {
	return &idBuilder{
		seen:    make(map[string]int),
		maxSize: idDeduperMaxSize,
	}
}

// unique returns id for its first occurrence and id_N for the N-th repeat.
// Suffixed ids cannot collide with base ids: base ids are hex digests and
// never contain `_`. When a new id would grow the set beyond maxSize, the
// set is reset first to keep memory bounded in long live-tail sessions.
func (b *idBuilder) unique(id string) string {
	n, ok := b.seen[id]
	if !ok && len(b.seen) >= b.maxSize {
		b.seen = make(map[string]int)
	}
	b.seen[id] = n + 1
	if n == 0 {
		return id
	}
	return id + "_" + strconv.Itoa(n)
}

// buildUniqLogID hashes the row fields into its base id and returns it
// uniquified within this builder's session
func (b *idBuilder) buildUniqLogID(ts, msg, streamId, labels []byte) string {
	logID := buildLogID(ts, msg, streamId, labels)
	return b.unique(logID)
}

// idSeparator delimits the fields hashed into a log id so that values can't
// run together across field boundaries (e.g. "ab"+"cd" vs "a"+"bcd").
var idSeparator = []byte{0}

func buildLogID(ts, msg, streamId, labels []byte) string {
	h := fnv.New64a()
	_, _ = h.Write(ts)
	_, _ = h.Write(idSeparator)
	_, _ = h.Write(msg)
	_, _ = h.Write(idSeparator)
	_, _ = h.Write(streamId)
	_, _ = h.Write(idSeparator)
	_, _ = h.Write(labels)
	return strconv.FormatUint(h.Sum64(), 16)
}
