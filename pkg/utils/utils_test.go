package utils

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestGetTime(t *testing.T) {
	type opts struct {
		s       string
		want    func() time.Time
		wantErr bool
	}
	f := func(opts opts) {
		t.Helper()
		got, err := GetTime(opts.s)
		if (err != nil) != opts.wantErr {
			t.Errorf("ParseTime() error = %v, wantErr %v", err, opts.wantErr)
			return
		}
		w := opts.want()
		if got.Unix() != w.Unix() {
			t.Errorf("ParseTime() got = %v, want %v", got, w)
		}
	}

	// empty string
	o := opts{
		want:    func() time.Time { return time.Time{} },
		wantErr: true,
	}
	f(o)

	// only year
	o = opts{
		s: "2019",
		want: func() time.Time {
			t := time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// year and month
	o = opts{
		s: "2019-01",
		want: func() time.Time {
			t := time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// year and not first month
	o = opts{
		s: "2019-02",
		want: func() time.Time {
			t := time.Date(2019, 2, 1, 0, 0, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// year, month and day
	o = opts{
		s: "2019-02-01",
		want: func() time.Time {
			t := time.Date(2019, 2, 1, 0, 0, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// year, month and not first day
	o = opts{
		s: "2019-02-10",
		want: func() time.Time {
			t := time.Date(2019, 2, 10, 0, 0, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// year, month, day and time
	o = opts{
		s: "2019-02-02T00",
		want: func() time.Time {
			t := time.Date(2019, 2, 2, 0, 0, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// year, month, day and one hour time
	o = opts{
		s: "2019-02-02T01",
		want: func() time.Time {
			t := time.Date(2019, 2, 2, 1, 0, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// time with zero minutes
	o = opts{
		s: "2019-02-02T01:00",
		want: func() time.Time {
			t := time.Date(2019, 2, 2, 1, 0, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// time with one minute
	o = opts{
		s: "2019-02-02T01:01",
		want: func() time.Time {
			t := time.Date(2019, 2, 2, 1, 1, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// time with zero seconds
	o = opts{
		s: "2019-02-02T01:01:00",
		want: func() time.Time {
			t := time.Date(2019, 2, 2, 1, 1, 0, 0, time.UTC)
			return t
		},
	}
	f(o)

	// timezone with one second
	o = opts{
		s: "2019-02-02T01:01:01",
		want: func() time.Time {
			t := time.Date(2019, 2, 2, 1, 1, 1, 0, time.UTC)
			return t
		},
	}
	f(o)

	// time with two second and timezone
	o = opts{
		s: "2019-07-07T20:01:02Z",
		want: func() time.Time {
			t := time.Date(2019, 7, 7, 20, 1, 02, 0, time.UTC)
			return t
		},
	}
	f(o)

	// time with seconds and timezone
	o = opts{
		s: "2019-07-07T20:47:40+03:00",
		want: func() time.Time {
			l, _ := time.LoadLocation("Europe/Kiev")
			t := time.Date(2019, 7, 7, 20, 47, 40, 0, l)
			return t
		},
	}
	f(o)

	// negative time
	o = opts{
		s:       "-292273086-05-16T16:47:06Z",
		want:    func() time.Time { return time.Time{} },
		wantErr: true,
	}
	f(o)

	// float timestamp representation
	o = opts{
		s: "1562529662.324",
		want: func() time.Time {
			t := time.Date(2019, 7, 7, 20, 01, 02, 324e6, time.UTC)
			return t
		},
	}
	f(o)

	// negative timestamp
	o = opts{
		s: "-9223372036.855",
		want: func() time.Time {
			return time.Date(1970, 01, 01, 00, 00, 00, 00, time.UTC)
		},
	}
	f(o)

	// big timestamp
	o = opts{
		s: "1223372036855",
		want: func() time.Time {
			t := time.Date(2008, 10, 7, 9, 33, 56, 855e6, time.UTC)
			return t
		},
	}
	f(o)

	// duration time
	o = opts{
		s: "1h5m",
		want: func() time.Time {
			t := time.Now().Add(-1 * time.Hour).Add(-5 * time.Minute)
			return t
		},
	}
	f(o)
}

func TestReplaceTemplateVariable(t *testing.T) {
	type opts struct {
		expr      string
		interval  int64
		timeRange backend.TimeRange
		want      string
	}

	f := func(opts opts) {
		t.Helper()
		if got := ReplaceTemplateVariable(opts.expr, opts.interval, opts.timeRange); got != opts.want {
			t.Errorf("ReplaceTemplateVariable() = %v, want %v", got, opts.want)
		}
	}

	// empty string
	o := opts{}
	f(o)

	// no variable
	o = opts{
		expr: "test",
		want: "test",
	}
	f(o)

	// variable
	o = opts{
		expr:     "$__interval",
		interval: 15,
		want:     "15ms",
	}
	f(o)

	// variable with text
	o = opts{
		expr:     "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:$__interval, host) count() logs",
		interval: 15,
		want:     "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:15ms, host) count() logs",
	}
	f(o)

	// variable with text and range
	o = opts{
		expr:     "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:$__range, host) count() logs",
		interval: 15,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:[1732320000, 1732492800], host) count() logs",
	}
	f(o)

	// simple range with stats request
	o = opts{
		expr:     "_time:$__range | stats count()",
		interval: 15,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: "_time:[1732320000, 1732492800] | stats count()",
	}
	f(o)
}

func Test_calculateStep(t *testing.T) {
	type opts struct {
		name         string
		baseInterval time.Duration
		timeRange    backend.TimeRange
		resolution   int64
		want         string
	}
	f := func(opts opts) {
		t.Helper()
		if got := CalculateStep(opts.baseInterval, opts.timeRange, opts.resolution); got.String() != opts.want {
			t.Errorf("calculateStep() = %v, want %v", got, opts.want)
		}
	}

	// one month timerange and max point 43200 with 20 second base interval
	o := opts{
		baseInterval: 20 * time.Second,
		timeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour * 24 * 30),
			To:   time.Now(),
		},
		resolution: 43200,
		want:       "1m0s",
	}
	f(o)

	// one month timerange interval max points 43200 with 1 second base interval
	o = opts{
		baseInterval: 1 * time.Second,
		timeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour * 24 * 30),
			To:   time.Now(),
		},
		resolution: 43200,
		want:       "1m0s",
	}
	f(o)

	// one month timerange interval max points 10000 with 5 second base interval
	o = opts{
		baseInterval: 5 * time.Second,
		timeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour * 24 * 30),
			To:   time.Now(),
		},
		resolution: 10000,
		want:       "5m0s",
	}
	f(o)

	// one month timerange interval max points 10000 with 5 second base interval
	o = opts{
		baseInterval: 5 * time.Second,
		timeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour * 1),
			To:   time.Now(),
		},
		resolution: 10000,
		want:       "5s",
	}
	f(o)

	// one month timerange interval max points 10000 with 5 second base interval
	o = opts{
		baseInterval: 2 * time.Minute,
		timeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour * 1),
			To:   time.Now(),
		},
		resolution: 10000,
		want:       "2m0s",
	}
	f(o)

	// two days time range with minimal resolution
	o = opts{
		baseInterval: 60 * time.Second,
		timeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour * 2 * 24),
			To:   time.Now(),
		},
		resolution: 100,
		want:       "30m0s",
	}
	f(o)

	// two days time range with minimal resolution
	o = opts{
		baseInterval: 60 * time.Second,
		timeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour * 24 * 90),
			To:   time.Now(),
		},
		resolution: 100000,
		want:       "1m0s",
	}
	f(o)
}

func Test_getIntervalFrom(t *testing.T) {
	type opts struct {
		dsInterval      string
		queryInterval   string
		queryIntervalMS int64
		defaultInterval time.Duration
		want            time.Duration
		wantErr         bool
	}
	f := func(opts opts) {
		t.Helper()
		got, err := GetIntervalFrom(opts.dsInterval, opts.queryInterval, opts.queryIntervalMS, opts.defaultInterval)
		if (err != nil) != opts.wantErr {
			t.Errorf("getIntervalFrom() error = %v, wantErr %v", err, opts.wantErr)
			return
		}
		if got != opts.want {
			t.Errorf("getIntervalFrom() got = %v, want %v", got, opts.want)
		}
	}

	// empty intervals
	o := opts{}
	f(o)

	// enabled dsInterval intervals
	o = opts{
		dsInterval: "20s",
		want:       time.Second * 20,
	}
	f(o)

	// enabled dsInterval and query intervals
	o = opts{
		dsInterval:    "20s",
		queryInterval: "10s",
		want:          time.Second * 10,
	}
	f(o)

	// enabled queryIntervalMS intervals
	o = opts{
		dsInterval:      "20s",
		queryInterval:   "10s",
		queryIntervalMS: 5000,
		want:            time.Second * 10,
	}
	f(o)

	// enabled queryIntervalMS and empty queryInterval intervals
	o = opts{
		dsInterval:      "20s",
		queryInterval:   "",
		queryIntervalMS: 5000,
		defaultInterval: 0,
		want:            time.Second * 5,
	}
	f(o)

	// enabled queryIntervalMS and defaultInterval
	o = opts{
		queryIntervalMS: 5000,
		defaultInterval: 10000,
		want:            time.Second * 5,
	}
	f(o)

	// enabled defaultInterval
	o = opts{
		defaultInterval: time.Second * 5,
		want:            time.Second * 5,
	}
	f(o)

	// enabled dsInterval only a number
	o = opts{
		dsInterval:      "123",
		defaultInterval: time.Second * 5,
		want:            time.Minute*2 + time.Second*3,
	}
	f(o)

	// dsInterval 0s
	o = opts{
		dsInterval:    "0s",
		queryInterval: "2s",
		want:          time.Second * 2,
	}
	f(o)

	// incorrect dsInterval
	o = opts{
		dsInterval: "a3",
		wantErr:    true,
	}
	f(o)

	// incorrect queryInterval
	o = opts{
		queryInterval: "a3",
		wantErr:       true,
	}
	f(o)
}

func TestAddTimeFieldWithRange(t *testing.T) {
	type opts struct {
		expr      string
		timeRange backend.TimeRange
		want      string
	}
	f := func(opts opts) {
		t.Helper()
		if got := AddTimeFieldWithRange(opts.expr, opts.timeRange); got != opts.want {
			t.Errorf("AddTimeFieldWithRange() = %v, want %v", got, opts.want)
		}
	}

	// empty string
	o := opts{
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
	}
	f(o)

	// simple expression
	o = opts{
		expr: "*",
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: "_time:[1732320000, 1732492800] *",
	}
	f(o)

	// simple range
	o = opts{
		expr: "_time:[1732320000, 1732492800]",
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: "_time:[1732320000, 1732492800]",
	}
	f(o)

	// simple stats request no time field
	o = opts{
		expr: "* | stats count()",
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: "_time:[1732320000, 1732492800] * | stats count()",
	}
	f(o)

	// simple stats request with time field
	o = opts{
		expr: "_time:1s | stats count()",
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: "_time:1s | stats count()",
	}
	f(o)

	// time field after the first pipe
	o = opts{
		expr: "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:1s, host) count() logs",
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: "_time:[1732320000, 1732492800] host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:1s, host) count() logs",
	}
	f(o)

	// time field present in the first part of the expression
	o = opts{
		expr: "_time:5s host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:$__range, host) count() logs",
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: "_time:5s host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:$__range, host) count() logs",
	}
	f(o)

	// complex query with pipes and time field in stats
	o = opts{
		expr: `kubernetes.pod_namespace:~"vm-operator" kubernetes.pod_name:~".*" kubernetes.container_name:~".*" 
| format if (log.level:"") "other" as log.level
| stats by (_time:1s) count()`,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: `_time:[1732320000, 1732492800] kubernetes.pod_namespace:~"vm-operator" kubernetes.pod_name:~".*" kubernetes.container_name:~".*" 
| format if (log.level:"") "other" as log.level
| stats by (_time:1s) count()`,
	}
	f(o)

	o = opts{
		expr: `options(concurrency=2) _time:1d | count_uniq(user_id)`,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: `options(concurrency=2) _time:1d | count_uniq(user_id)`,
	}
	f(o)
	o = opts{
		expr: `options(concurrency=2) | count_uniq(user_id)`,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: `options(concurrency=2) _time:[1732320000, 1732492800] | count_uniq(user_id)`,
	}
	f(o)

	o = opts{
		expr: `options(time_offset=7d) error | stats count() as 'errors_7d_ago'`,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: `options(time_offset=7d) _time:[1732320000, 1732492800] error | stats count() as 'errors_7d_ago'`,
	}
	f(o)

	o = opts{
		expr: `options(time_offset=7d) _time:1h error | stats count() as 'errors_7d_ago'`,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: `options(time_offset=7d) _time:1h error | stats count() as 'errors_7d_ago'`,
	}
	f(o)

	o = opts{
		expr: `user_id:in(options(ignore_global_time_filter=true) _time:2024-12Z | keep user_id) | count()`,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: `user_id:in(options(ignore_global_time_filter=true) _time:2024-12Z | keep user_id) | count()`,
	}
	f(o)

	o = opts{
		expr: `user_id:in(options(ignore_global_time_filter=true) | keep user_id) | count()`,
		timeRange: backend.TimeRange{
			From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
		},
		want: `user_id:in(options(ignore_global_time_filter=true) _time:[1732320000, 1732492800] | keep user_id) | count()`,
	}
	f(o)
}

func TestTryParseTimestampRFC3339NanoString_Success(t *testing.T) {
	f := func(s, timestampExpected string) {
		t.Helper()

		nsecs, ok := TryParseTimestampRFC3339Nano(s)
		if !ok {
			t.Fatalf("cannot parse timestamp %q", s)
		}
		timestamp := time.Unix(0, nsecs).UTC().AppendFormat(nil, time.RFC3339Nano)
		if string(timestamp) != timestampExpected {
			t.Fatalf("unexpected timestamp; got %q; want %q", timestamp, timestampExpected)
		}
	}

	// No fractional seconds
	f("2023-01-15T23:45:51Z", "2023-01-15T23:45:51Z")

	// Different number of fractional seconds
	f("2023-01-15T23:45:51.1Z", "2023-01-15T23:45:51.1Z")
	f("2023-01-15T23:45:51.12Z", "2023-01-15T23:45:51.12Z")
	f("2023-01-15T23:45:51.123Z", "2023-01-15T23:45:51.123Z")
	f("2023-01-15T23:45:51.1234Z", "2023-01-15T23:45:51.1234Z")
	f("2023-01-15T23:45:51.12345Z", "2023-01-15T23:45:51.12345Z")
	f("2023-01-15T23:45:51.123456Z", "2023-01-15T23:45:51.123456Z")
	f("2023-01-15T23:45:51.1234567Z", "2023-01-15T23:45:51.1234567Z")
	f("2023-01-15T23:45:51.12345678Z", "2023-01-15T23:45:51.12345678Z")
	f("2023-01-15T23:45:51.123456789Z", "2023-01-15T23:45:51.123456789Z")

	// The minimum possible timestamp
	f("1677-09-21T00:12:44Z", "1677-09-21T00:12:44Z")

	// The maximum possible timestamp
	f("2262-04-11T23:47:15.999999999Z", "2262-04-11T23:47:15.999999999Z")

	// timestamp with timezone
	f("2023-01-16T00:45:51+01:00", "2023-01-15T23:45:51Z")
	f("2023-01-16T00:45:51.123-01:00", "2023-01-16T01:45:51.123Z")

	// SQL datetime format
	// See https://github.com/VictoriaMetrics/VictoriaMetrics/issues/6721
	f("2023-01-16 00:45:51+01:00", "2023-01-15T23:45:51Z")
	f("2023-01-16 00:45:51.123-01:00", "2023-01-16T01:45:51.123Z")
}

func TestTryParseTimestampRFC3339Nano_Failure(t *testing.T) {
	f := func(s string) {
		t.Helper()
		_, ok := TryParseTimestampRFC3339Nano(s)
		if ok {
			t.Fatalf("expecting failure when parsing %q", s)
		}
	}

	// invalid length
	f("")
	f("foobar")

	// missing fractional part after dot
	f("2023-01-15T22:15:51.Z")

	// too small year
	f("1676-09-21T00:12:43Z")

	// too big year
	f("2263-04-11T23:47:17Z")

	// too small timestamp
	f("1677-09-21T00:12:43.999999999Z")

	// too big timestamp
	f("2262-04-11T23:47:16Z")

	// invalid year
	f("YYYY-04-11T23:47:17Z")

	// invalid moth
	f("2023-MM-11T23:47:17Z")

	// invalid day
	f("2023-01-DDT23:47:17Z")

	// invalid hour
	f("2023-01-23Thh:47:17Z")

	// invalid minute
	f("2023-01-23T23:mm:17Z")

	// invalid second
	f("2023-01-23T23:33:ssZ")
}

func TestRoundInterval(t *testing.T) {
	type testCase struct {
		name     string
		input    time.Duration
		expected time.Duration
	}

	cases := []testCase{
		// Milliseconds rounding
		{name: "Round to 1ms", input: 5 * time.Millisecond, expected: 1 * time.Millisecond},
		{name: "Round to 10ms", input: 12 * time.Millisecond, expected: 10 * time.Millisecond},
		{name: "Round to 20ms", input: 25 * time.Millisecond, expected: 20 * time.Millisecond},
		{name: "Round to 50ms", input: 60 * time.Millisecond, expected: 50 * time.Millisecond},
		{name: "Round to 100ms", input: 125 * time.Millisecond, expected: 100 * time.Millisecond},

		// Seconds rounding
		{name: "Round to 1s", input: 1*time.Second + 200*time.Millisecond, expected: 1 * time.Second},
		{name: "Round to 2s", input: 3 * time.Second, expected: 2 * time.Second},
		{name: "Round to 5s", input: 6 * time.Second, expected: 5 * time.Second},
		{name: "Round to 10s", input: 12 * time.Second, expected: 10 * time.Second},
		{name: "Round to 15s", input: 17 * time.Second, expected: 15 * time.Second},

		// Minutes rounding
		{name: "Round to 1m", input: 70 * time.Second, expected: 1 * time.Minute},
		{name: "Round to 2m", input: 125 * time.Second, expected: 2 * time.Minute},
		{name: "Round to 30m", input: 40 * time.Minute, expected: 30 * time.Minute},
		{name: "Round to 1h", input: 75 * time.Minute, expected: 1 * time.Hour},
		{name: "Round to 2h", input: 2*time.Hour + 30*time.Minute, expected: 3 * time.Hour},

		// Large intervals
		{name: "Round to 6h", input: 7 * time.Hour, expected: 6 * time.Hour},
		{name: "Round to 12h", input: 14 * time.Hour, expected: 12 * time.Hour},
		{name: "Round to 12h", input: 20 * time.Hour, expected: 12 * time.Hour},
		{name: "Round to 7d", input: 8 * 24 * time.Hour, expected: 7 * 24 * time.Hour},
		{name: "Round to 30d", input: 31 * 24 * time.Hour, expected: 30 * 24 * time.Hour},
		{name: "Round to 1y", input: 400 * 24 * time.Hour, expected: 365 * 24 * time.Hour},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := roundInterval(tc.input)
			if result != tc.expected {
				t.Errorf("roundInterval(%v) = %v; want %v", tc.input, result, tc.expected)
			}
		})
	}
}
