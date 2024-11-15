package plugin

import (
	"testing"
	"time"
)

func TestQuery_getQueryURL(t *testing.T) {
	type fields struct {
		RefID     string
		Expr      string
		MaxLines  int
		TimeRange TimeRange
		QueryType QueryType
	}
	type args struct {
		rawURL      string
		queryParams string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    string
		wantErr bool
	}{
		{
			name: "empty values",
			fields: fields{
				RefID:     "1",
				Expr:      "",
				MaxLines:  0,
				TimeRange: TimeRange{},
				QueryType: QueryTypeInstant,
			},
			args: args{
				rawURL:      "",
				queryParams: "",
			},
			want:    "",
			wantErr: true,
		},
		{
			name: "empty values stats",
			fields: fields{
				RefID:     "1",
				Expr:      "",
				MaxLines:  0,
				TimeRange: TimeRange{},
				QueryType: QueryTypeStats,
			},
			args: args{
				rawURL:      "",
				queryParams: "",
			},
			want:    "",
			wantErr: true,
		},
		{
			name: "empty values stats range",
			fields: fields{
				RefID:     "1",
				Expr:      "",
				MaxLines:  0,
				TimeRange: TimeRange{},
				QueryType: QueryTypeStatsRange,
			},
			args: args{
				rawURL:      "",
				queryParams: "",
			},
			want:    "",
			wantErr: true,
		},
		{
			name: "has rawURL without params",
			fields: fields{
				RefID:    "1",
				Expr:     "",
				MaxLines: 0,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeInstant,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?end=1609462800&limit=1000&query=&start=1609459200",
			wantErr: false,
		},
		{
			name: "has rawURL without params stats",
			fields: fields{
				RefID:    "1",
				Expr:     "",
				MaxLines: 0,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeStats,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/stats_query?query=&time=1609462800",
			wantErr: false,
		},
		{
			name: "has rawURL without params stats range",
			fields: fields{
				RefID:    "1",
				Expr:     "",
				MaxLines: 0,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeStatsRange,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/stats_query_range?end=1609462800&query=&start=1609459200&step=15s",
			wantErr: false,
		},
		{
			name: "has expression and max lines",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s",
				MaxLines: 10,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeInstant,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?end=1609462800&limit=10&query=_time%3A1s&start=1609459200",
			wantErr: false,
		},
		{
			name: "has expression and max lines stats",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s | stats by(type) count()",
				MaxLines: 10,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeStats,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/stats_query?query=_time%3A1s+%7C+stats+by%28type%29+count%28%29&time=1609462800",
			wantErr: false,
		},
		{
			name: "has expression and max lines stats",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s | stats by(type) count()",
				MaxLines: 10,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeStatsRange,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/stats_query_range?end=1609462800&query=_time%3A1s+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
			wantErr: false,
		},
		{
			name: "has expression and max lines, with queryParams",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s and syslog",
				MaxLines: 10,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeInstant,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "a=1&b=2",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?a=1&b=2&end=1609462800&limit=10&query=_time%3A1s+and+syslog&start=1609459200",
			wantErr: false,
		},
		{
			name: "has expression and max lines, with queryParams",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s and syslog | stats by(type) count()",
				MaxLines: 10,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeStats,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "a=1&b=2",
			},
			want:    "http://127.0.0.1:9428/select/logsql/stats_query?a=1&b=2&query=_time%3A1s+and+syslog+%7C+stats+by%28type%29+count%28%29&time=1609462800",
			wantErr: false,
		},
		{
			name: "has expression and max lines, with queryParams",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s and syslog | stats by(type) count()",
				MaxLines: 10,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeStatsRange,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "a=1&b=2",
			},
			want:    "http://127.0.0.1:9428/select/logsql/stats_query_range?a=1&b=2&end=1609462800&query=_time%3A1s+and+syslog+%7C+stats+by%28type%29+count%28%29&start=1609459200&step=15s",
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := &Query{
				RefID:     tt.fields.RefID,
				Expr:      tt.fields.Expr,
				MaxLines:  tt.fields.MaxLines,
				TimeRange: tt.fields.TimeRange,
				QueryType: tt.fields.QueryType,
			}
			got, err := q.getQueryURL(tt.args.rawURL, tt.args.queryParams)
			if (err != nil) != tt.wantErr {
				t.Errorf("getQueryURL() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("getQueryURL() got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestQuery_queryTailURL(t *testing.T) {
	type fields struct {
		RefID     string
		Expr      string
		MaxLines  int
		TimeRange TimeRange
		QueryType QueryType
	}
	type args struct {
		rawURL      string
		queryParams string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    string
		wantErr bool
	}{
		{
			name: "empty values",
			fields: fields{
				RefID:     "1",
				Expr:      "",
				MaxLines:  0,
				TimeRange: TimeRange{},
				QueryType: QueryTypeInstant,
			},
			args: args{
				rawURL:      "",
				queryParams: "",
			},
			want:    "",
			wantErr: true,
		},
		{
			name: "has rawURL without params",
			fields: fields{
				RefID:    "1",
				Expr:     "",
				MaxLines: 0,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeInstant,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/tail?query=",
			wantErr: false,
		},
		{
			name: "has expression and max lines",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s",
				MaxLines: 10,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeInstant,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/tail?query=_time%3A1s",
			wantErr: false,
		},
		{
			name: "has expression and max lines, with queryParams",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s and syslog",
				MaxLines: 10,
				TimeRange: TimeRange{
					From: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2021, 1, 1, 1, 0, 0, 0, time.UTC),
				},
				QueryType: QueryTypeInstant,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "a=1&b=2",
			},
			want:    "http://127.0.0.1:9428/select/logsql/tail?a=1&b=2&query=_time%3A1s+and+syslog",
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := &Query{
				RefID:     tt.fields.RefID,
				Expr:      tt.fields.Expr,
				MaxLines:  tt.fields.MaxLines,
				TimeRange: tt.fields.TimeRange,
				QueryType: tt.fields.QueryType,
			}
			got, err := q.queryTailURL(tt.args.rawURL, tt.args.queryParams)
			if (err != nil) != tt.wantErr {
				t.Errorf("queryTailURL() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("queryTailURL() got = %v, want %v", got, tt.want)
			}
		})
	}
}
