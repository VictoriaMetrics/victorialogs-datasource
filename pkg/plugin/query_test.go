package plugin

import (
	"testing"
)

func TestQuery_getQueryURL(t *testing.T) {
	type fields struct {
		RefID    string
		Expr     string
		MaxLines int
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
				RefID:    "1",
				Expr:     "",
				MaxLines: 0,
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
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?limit=1000&query=",
			wantErr: false,
		},
		{
			name: "has expression and max lines",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s",
				MaxLines: 10,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?limit=10&query=_time%3A1s",
			wantErr: false,
		},
		{
			name: "has expression and max lines, with queryParams",
			fields: fields{
				RefID:    "1",
				Expr:     "_time:1s and syslog",
				MaxLines: 10,
			},
			args: args{
				rawURL:      "http://127.0.0.1:9428",
				queryParams: "a=1&b=2",
			},
			want:    "http://127.0.0.1:9428/select/logsql/query?a=1&b=2&limit=10&query=_time%3A1s+and+syslog",
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := &Query{
				RefID:    tt.fields.RefID,
				Expr:     tt.fields.Expr,
				MaxLines: tt.fields.MaxLines,
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
