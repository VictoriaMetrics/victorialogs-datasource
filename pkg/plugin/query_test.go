package plugin

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestQuery_getQueryURL(t *testing.T) {
	type opts struct {
		RefID          string
		Expr           string
		MaxLines       int
		TimeRange      backend.TimeRange
		QueryType      QueryType
		ExtraFilters   string
		TimezoneOffset string
		rawURL         string
		queryParams    string
		want           string
		wantErr        bool
	}

	f := func(opts opts) {
		t.Helper()
		q := &Query{
			DataQuery: backend.DataQuery{
				RefID:     opts.RefID,
				TimeRange: opts.TimeRange,
			},
			Expr:           opts.Expr,
			MaxLines:       opts.MaxLines,
			QueryType:      opts.QueryType,
			ExtraFilters:   opts.ExtraFilters,
			TimezoneOffset: opts.TimezoneOffset,
		}
		got, err := q.getQueryURL(opts.rawURL, opts.queryParams)
		if (err != nil) != opts.wantErr {
			t.Errorf("getQueryURL() error = %v, wantErr %v", err, opts.wantErr)
			return
		}
		if got != opts.want {
			t.Errorf("getQueryURL() got = %v, want %v", got, opts.want)
		}
	}

	// empty values
	o := opts{
		RefID:     "1",
		QueryType: QueryTypeInstant,
		wantErr:   true,
	}
	f(o)

	// empty values stats
	o = opts{
		RefID:     "1",
		QueryType: QueryTypeStats,
		wantErr:   true,
	}
	f(o)

	// empty values stats range
	o = opts{
		RefID:     "1",
		QueryType: QueryTypeStatsRange,
		wantErr:   true,
	}
	f(o)

	// has rawURL without params
	o = opts{
		RefID: "1",
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeInstant,
		rawURL:    "http://127.0.0.1:9428",
		want:      "http://127.0.0.1:9428/select/logsql/query?end=1609462800&limit=1000&query=&start=1609459200",
	}
	f(o)

	// has rawURL without params stats
	o = opts{
		RefID: "1",
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeStats,
		rawURL:    "http://127.0.0.1:9428",
		want:      "http://127.0.0.1:9428/select/logsql/stats_query?query=&time=1609462800",
		wantErr:   false,
	}
	f(o)

	// has rawURL without params stats range
	o = opts{
		RefID: "1",
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeStatsRange,
		rawURL:    "http://127.0.0.1:9428",
		want:      "http://127.0.0.1:9428/select/logsql/stats_query_range?end=1609462800&query=&start=1609459200&step=15s",
	}
	f(o)

	// has expression and max lines
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeInstant,
		rawURL:    "http://127.0.0.1:9428",
		want:      "http://127.0.0.1:9428/select/logsql/query?end=1609462800&limit=10&query=_time%3A1s&start=1609459200",
	}
	f(o)

	// has expression and max lines stats
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeStats,
		rawURL:    "http://127.0.0.1:9428",
		want:      "http://127.0.0.1:9428/select/logsql/stats_query?query=_time%3A1s+%7C+stats+by%28type%29+count%28%29&time=1609462800",
	}
	f(o)

	// has expression and max lines stats
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeStatsRange,
		rawURL:    "http://127.0.0.1:9428",
		want:      "http://127.0.0.1:9428/select/logsql/stats_query_range?end=1609462800&query=_time%3A1s+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// has expression and max lines, with queryParams
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s and syslog",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:   QueryTypeInstant,
		rawURL:      "http://127.0.0.1:9428",
		queryParams: "a=1&b=2",
		want:        "http://127.0.0.1:9428/select/logsql/query?a=1&b=2&end=1609462800&limit=10&query=_time%3A1s+and+syslog&start=1609459200",
	}
	f(o)

	// has expression and max lines, with queryParams
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s and syslog | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:   QueryTypeStats,
		rawURL:      "http://127.0.0.1:9428",
		queryParams: "a=1&b=2",
		want:        "http://127.0.0.1:9428/select/logsql/stats_query?a=1&b=2&query=_time%3A1s+and+syslog+%7C+stats+by%28type%29+count%28%29&time=1609462800",
	}
	f(o)

	// has expression and max lines, with queryParams
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s and syslog | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:   QueryTypeStatsRange,
		rawURL:      "http://127.0.0.1:9428",
		queryParams: "a=1&b=2",
		want:        "http://127.0.0.1:9428/select/logsql/stats_query_range?a=1&b=2&end=1609462800&query=_time%3A1s+and+syslog+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// stats query without time field
	o = opts{
		RefID:    "1",
		Expr:     "* and syslog | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:   QueryTypeStats,
		rawURL:      "http://127.0.0.1:9428",
		queryParams: "a=1&b=2",
		want:        "http://127.0.0.1:9428/select/logsql/stats_query?a=1&b=2&query=_time%3A%5B1609459200%2C+1609462800%5D+%2A+and+syslog+%7C+stats+by%28type%29+count%28%29&time=1609462800",
	}
	f(o)

	// empty values hits
	o = opts{
		RefID:     "1",
		QueryType: QueryTypeHits,
		wantErr:   true,
	}
	f(o)

	// has rawURL without params for hits
	o = opts{
		RefID: "1",
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=&start=1609459200&step=15s",
	}
	f(o)

	// has rawURL without params for hits
	o = opts{
		RefID: "1",
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=&start=1609459200&step=15s",
	}
	f(o)

	// has rawURL without params for hist
	o = opts{
		RefID: "1",
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=&start=1609459200&step=15s",
	}
	f(o)

	// has expression and max lines
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=_time%3A1s&start=1609459200&step=15s",
	}
	f(o)

	// has expression and max lines stats
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=_time%3A1s+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// has expression and max lines stats
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:   QueryTypeHits,
		rawURL:      "http://127.0.0.1:9429",
		queryParams: "",
		want:        "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=_time%3A1s+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// has expression and max lines, with queryParams for hits
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s and syslog",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=_time%3A1s+and+syslog&start=1609459200&step=15s",
	}
	f(o)

	// has expression and max lines, with queryParams for hits
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s and syslog | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=_time%3A1s+and+syslog+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// has expression and max lines, with queryParams for hits
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s and syslog | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=_time%3A1s+and+syslog+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// stats query without time field for hits
	o = opts{
		RefID:    "1",
		Expr:     "* and syslog | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=%2A+and+syslog+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// with extra filters
	o = opts{
		RefID:    "1",
		Expr:     "* and syslog | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:    QueryTypeHits,
		ExtraFilters: "key1:\"value1\" AND key2:\"value2\"",
		rawURL:       "http://127.0.0.1:9429",
		want:         "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&extra_filters=key1%3A%22value1%22+AND+key2%3A%22value2%22&query=%2A+and+syslog+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// with empty extra filters
	o = opts{
		RefID:    "1",
		Expr:     "* and syslog | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeHits,
		rawURL:    "http://127.0.0.1:9429",
		want:      "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=%2A+and+syslog+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// stats range with timezone offset
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:      QueryTypeStatsRange,
		TimezoneOffset: "2h",
		rawURL:         "http://127.0.0.1:9428",
		want:           "http://127.0.0.1:9428/select/logsql/stats_query_range?end=1609462800&offset=2h&query=_time%3A1s+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// stats range with negative timezone offset
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s | stats by(type) count()",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:      QueryTypeStatsRange,
		TimezoneOffset: "-5h30m",
		rawURL:         "http://127.0.0.1:9428",
		want:           "http://127.0.0.1:9428/select/logsql/stats_query_range?end=1609462800&offset=-5h30m&query=_time%3A1s+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
	}
	f(o)

	// hits with timezone offset
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:      QueryTypeHits,
		TimezoneOffset: "5h30m",
		rawURL:         "http://127.0.0.1:9429",
		want:           "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&offset=5h30m&query=_time%3A1s&start=1609459200&step=15s",
	}
	f(o)

	// hits without timezone offset (empty string) - should not include offset param
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:      QueryTypeHits,
		TimezoneOffset: "",
		rawURL:         "http://127.0.0.1:9429",
		want:           "http://127.0.0.1:9429/select/logsql/hits?end=1609462800&query=_time%3A1s&start=1609459200&step=15s",
	}
	f(o)
}

func TestQuery_queryTailURL(t *testing.T) {
	type opts struct {
		RefID       string
		Expr        string
		MaxLines    int
		TimeRange   backend.TimeRange
		QueryType   QueryType
		rawURL      string
		queryParams string
		want        string
		wantErr     bool
	}
	f := func(opts opts) {
		t.Helper()
		q := &Query{
			DataQuery: backend.DataQuery{
				RefID:     opts.RefID,
				QueryType: string(opts.QueryType),
				TimeRange: opts.TimeRange,
			},
			Expr:     opts.Expr,
			MaxLines: opts.MaxLines,
		}
		got, err := q.queryTailURL(opts.rawURL, opts.queryParams)
		if (err != nil) != opts.wantErr {
			t.Errorf("queryTailURL() error = %v, wantErr %v", err, opts.wantErr)
			return
		}
		if got != opts.want {
			t.Errorf("queryTailURL() got = %v, want %v", got, opts.want)
		}
	}

	// empty values
	o := opts{
		RefID:     "1",
		QueryType: QueryTypeInstant,
		wantErr:   true,
	}
	f(o)

	// has rawURL without params
	o = opts{
		RefID: "1",
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeInstant,
		rawURL:    "http://127.0.0.1:9428",
		want:      "http://127.0.0.1:9428/select/logsql/tail?query=",
	}
	f(o)

	// has expression and max lines
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType: QueryTypeInstant,
		rawURL:    "http://127.0.0.1:9428",
		want:      "http://127.0.0.1:9428/select/logsql/tail?query=_time%3A1s",
	}
	f(o)

	// has expression and max lines, with queryParams
	o = opts{
		RefID:    "1",
		Expr:     "_time:1s and syslog",
		MaxLines: 10,
		TimeRange: backend.TimeRange{
			From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		QueryType:   QueryTypeInstant,
		rawURL:      "http://127.0.0.1:9428",
		queryParams: "a=1&b=2",
		want:        "http://127.0.0.1:9428/select/logsql/tail?a=1&b=2&query=_time%3A1s+and+syslog",
	}
	f(o)
}
