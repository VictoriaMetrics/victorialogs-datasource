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
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?end=1609462800&limit=1000&query=&start=1609459200",
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
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?end=1609462800&limit=10&query=_time%3A1s&start=1609459200",
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
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "a=1&b=2",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?a=1&b=2&end=1609462800&limit=10&query=_time%3A1s+and+syslog&start=1609459200",
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
