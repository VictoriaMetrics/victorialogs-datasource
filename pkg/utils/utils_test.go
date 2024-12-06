package utils

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestGetTime(t *testing.T) {
	tests := []struct {
		name    string
		s       string
		want    func() time.Time
		wantErr bool
	}{
		{
			name:    "empty string",
			s:       "",
			want:    func() time.Time { return time.Time{} },
			wantErr: true,
		},
		{
			name: "only year",
			s:    "2019",
			want: func() time.Time {
				t := time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "year and month",
			s:    "2019-01",
			want: func() time.Time {
				t := time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "year and not first month",
			s:    "2019-02",
			want: func() time.Time {
				t := time.Date(2019, 2, 1, 0, 0, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "year, month and day",
			s:    "2019-02-01",
			want: func() time.Time {
				t := time.Date(2019, 2, 1, 0, 0, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "year, month and not first day",
			s:    "2019-02-10",
			want: func() time.Time {
				t := time.Date(2019, 2, 10, 0, 0, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "year, month, day and time",
			s:    "2019-02-02T00",
			want: func() time.Time {
				t := time.Date(2019, 2, 2, 0, 0, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "year, month, day and one hour time",
			s:    "2019-02-02T01",
			want: func() time.Time {
				t := time.Date(2019, 2, 2, 1, 0, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "time with zero minutes",
			s:    "2019-02-02T01:00",
			want: func() time.Time {
				t := time.Date(2019, 2, 2, 1, 0, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "time with one minute",
			s:    "2019-02-02T01:01",
			want: func() time.Time {
				t := time.Date(2019, 2, 2, 1, 1, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "time with zero seconds",
			s:    "2019-02-02T01:01:00",
			want: func() time.Time {
				t := time.Date(2019, 2, 2, 1, 1, 0, 0, time.UTC)
				return t
			},
		},
		{
			name: "timezone with one second",
			s:    "2019-02-02T01:01:01",
			want: func() time.Time {
				t := time.Date(2019, 2, 2, 1, 1, 1, 0, time.UTC)
				return t
			},
		},
		{
			name: "time with two second and timezone",
			s:    "2019-07-07T20:01:02Z",
			want: func() time.Time {
				t := time.Date(2019, 7, 7, 20, 1, 02, 0, time.UTC)
				return t
			},
		},
		{
			name: "time with seconds and timezone",
			s:    "2019-07-07T20:47:40+03:00",
			want: func() time.Time {
				l, _ := time.LoadLocation("Europe/Kiev")
				t := time.Date(2019, 7, 7, 20, 47, 40, 0, l)
				return t
			},
		},
		{
			name:    "negative time",
			s:       "-292273086-05-16T16:47:06Z",
			want:    func() time.Time { return time.Time{} },
			wantErr: true,
		},
		{
			name: "float timestamp representation",
			s:    "1562529662.324",
			want: func() time.Time {
				t := time.Date(2019, 7, 7, 20, 01, 02, 324e6, time.UTC)
				return t
			},
		},
		{
			name: "negative timestamp",
			s:    "-9223372036.855",
			want: func() time.Time {
				return time.Date(1970, 01, 01, 00, 00, 00, 00, time.UTC)
			},
			wantErr: false,
		},
		{
			name: "big timestamp",
			s:    "1223372036855",
			want: func() time.Time {
				t := time.Date(2008, 10, 7, 9, 33, 56, 855e6, time.UTC)
				return t
			},
			wantErr: false,
		},
		{
			name: "duration time",
			s:    "1h5m",
			want: func() time.Time {
				t := time.Now().Add(-1 * time.Hour).Add(-5 * time.Minute)
				return t
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetTime(tt.s)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseTime() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			w := tt.want()
			if got.Unix() != w.Unix() {
				t.Errorf("ParseTime() got = %v, want %v", got, w)
			}
		})
	}
}

func TestReplaceTemplateVariable(t *testing.T) {
	tests := []struct {
		name      string
		expr      string
		interval  int64
		timeRange backend.TimeRange
		want      string
	}{
		{
			name:     "empty string",
			expr:     "",
			interval: 0,
			timeRange: backend.TimeRange{
				From: time.Time{},
				To:   time.Time{},
			},
			want: "",
		},
		{
			name:     "no variable",
			expr:     "test",
			interval: 0,
			timeRange: backend.TimeRange{
				From: time.Time{},
				To:   time.Time{},
			},
			want: "test",
		},
		{
			name:     "variable",
			expr:     "$__interval",
			interval: 15,
			timeRange: backend.TimeRange{
				From: time.Time{},
				To:   time.Time{},
			},
			want: "15ms",
		},
		{
			name:     "variable with text",
			expr:     "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:$__interval, host) count() logs",
			interval: 15,
			timeRange: backend.TimeRange{
				From: time.Time{},
				To:   time.Time{},
			},
			want: "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:15ms, host) count() logs",
		},
		{
			name:     "variable with text and range",
			expr:     "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:$__range, host) count() logs",
			interval: 15,
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:[1732320000, 1732492800], host) count() logs",
		},
		{
			name:     "simple range with stats request",
			expr:     "_time:$__range | stats count()",
			interval: 15,
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "_time:[1732320000, 1732492800] | stats count()",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ReplaceTemplateVariable(tt.expr, tt.interval, tt.timeRange); got != tt.want {
				t.Errorf("ReplaceTemplateVariable() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_calculateStep(t *testing.T) {
	tests := []struct {
		name         string
		baseInterval time.Duration
		timeRange    backend.TimeRange
		resolution   int64
		want         string
	}{
		{
			name:         "one month timerange and max point 43200 with 20 second base interval",
			baseInterval: 20 * time.Second,
			timeRange: backend.TimeRange{
				From: time.Now().Add(-time.Hour * 24 * 30),
				To:   time.Now(),
			},
			resolution: 43200,
			want:       "1m0s",
		},
		{
			name:         "one month timerange interval max points 43200 with 1 second base interval",
			baseInterval: 1 * time.Second,
			timeRange: backend.TimeRange{
				From: time.Now().Add(-time.Hour * 24 * 30),
				To:   time.Now(),
			},
			resolution: 43200,
			want:       "1m0s",
		},
		{
			name:         "one month timerange interval max points 10000 with 5 second base interval",
			baseInterval: 5 * time.Second,
			timeRange: backend.TimeRange{
				From: time.Now().Add(-time.Hour * 24 * 30),
				To:   time.Now(),
			},
			resolution: 10000,
			want:       "5m0s",
		},
		{
			name:         "one month timerange interval max points 10000 with 5 second base interval",
			baseInterval: 5 * time.Second,
			timeRange: backend.TimeRange{
				From: time.Now().Add(-time.Hour * 1),
				To:   time.Now(),
			},
			resolution: 10000,
			want:       "5s",
		},
		{
			name:         "one month timerange interval max points 10000 with 5 second base interval",
			baseInterval: 2 * time.Minute,
			timeRange: backend.TimeRange{
				From: time.Now().Add(-time.Hour * 1),
				To:   time.Now(),
			},
			resolution: 10000,
			want:       "2m0s",
		},
		{
			name:         "two days time range with minimal resolution",
			baseInterval: 60 * time.Second,
			timeRange: backend.TimeRange{
				From: time.Now().Add(-time.Hour * 2 * 24),
				To:   time.Now(),
			},
			resolution: 100,
			want:       "30m0s",
		},
		{
			name:         "two days time range with minimal resolution",
			baseInterval: 60 * time.Second,
			timeRange: backend.TimeRange{
				From: time.Now().Add(-time.Hour * 24 * 90),
				To:   time.Now(),
			},
			resolution: 100000,
			want:       "1m0s",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CalculateStep(tt.baseInterval, tt.timeRange, tt.resolution); got.String() != tt.want {
				t.Errorf("calculateStep() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_getIntervalFrom(t *testing.T) {
	type args struct {
		dsInterval      string
		queryInterval   string
		queryIntervalMS int64
		defaultInterval time.Duration
	}
	tests := []struct {
		name    string
		args    args
		want    time.Duration
		wantErr bool
	}{
		{
			name: "empty intervals",
			args: args{
				dsInterval:      "",
				queryInterval:   "",
				queryIntervalMS: 0,
				defaultInterval: 0,
			},
			want:    0,
			wantErr: false,
		},
		{
			name: "enabled dsInterval intervals",
			args: args{
				dsInterval:      "20s",
				queryInterval:   "",
				queryIntervalMS: 0,
				defaultInterval: 0,
			},
			want:    time.Second * 20,
			wantErr: false,
		},
		{
			name: "enabled dsInterval and query intervals",
			args: args{
				dsInterval:      "20s",
				queryInterval:   "10s",
				queryIntervalMS: 0,
				defaultInterval: 0,
			},
			want:    time.Second * 10,
			wantErr: false,
		},
		{
			name: "enabled queryIntervalMS intervals",
			args: args{
				dsInterval:      "20s",
				queryInterval:   "10s",
				queryIntervalMS: 5000,
				defaultInterval: 0,
			},
			want:    time.Second * 10,
			wantErr: false,
		},
		{
			name: "enabled queryIntervalMS and empty queryInterval intervals",
			args: args{
				dsInterval:      "20s",
				queryInterval:   "",
				queryIntervalMS: 5000,
				defaultInterval: 0,
			},
			want:    time.Second * 5,
			wantErr: false,
		},
		{
			name: "enabled queryIntervalMS and defaultInterval",
			args: args{
				dsInterval:      "",
				queryInterval:   "",
				queryIntervalMS: 5000,
				defaultInterval: 10000,
			},
			want:    time.Second * 5,
			wantErr: false,
		},
		{
			name: "enabled defaultInterval",
			args: args{
				dsInterval:      "",
				queryInterval:   "",
				queryIntervalMS: 0,
				defaultInterval: time.Second * 5,
			},
			want:    time.Second * 5,
			wantErr: false,
		},
		{
			name: "enabled dsInterval only a number",
			args: args{
				dsInterval:      "123",
				queryInterval:   "",
				queryIntervalMS: 0,
				defaultInterval: time.Second * 5,
			},
			want:    time.Minute*2 + time.Second*3,
			wantErr: false,
		},
		{
			name: "dsInterval 0s",
			args: args{
				dsInterval:      "0s",
				queryInterval:   "2s",
				queryIntervalMS: 0,
				defaultInterval: 0,
			},
			want:    time.Second * 2,
			wantErr: false,
		},
		{
			name: "incorrect dsInterval",
			args: args{
				dsInterval:      "a3",
				queryInterval:   "",
				queryIntervalMS: 0,
				defaultInterval: 0,
			},
			want:    0,
			wantErr: true,
		},
		{
			name: "incorrect queryInterval",
			args: args{
				dsInterval:      "",
				queryInterval:   "a3",
				queryIntervalMS: 0,
				defaultInterval: 0,
			},
			want:    0,
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetIntervalFrom(tt.args.dsInterval, tt.args.queryInterval, tt.args.queryIntervalMS, tt.args.defaultInterval)
			if (err != nil) != tt.wantErr {
				t.Errorf("getIntervalFrom() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("getIntervalFrom() got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAddTimeFieldWithRange(t *testing.T) {
	tests := []struct {
		name      string
		expr      string
		timeRange backend.TimeRange
		want      string
	}{
		{
			name: "empty string",
			expr: "",
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "",
		},
		{
			name: "simple expression",
			expr: "*",
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "_time:[1732320000, 1732492800] *",
		},
		{
			name: "simple range",
			expr: "_time:[1732320000, 1732492800]",
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "_time:[1732320000, 1732492800]",
		},
		{
			name: "simple stats request no time field",
			expr: "* | stats count()",
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "_time:[1732320000, 1732492800] * | stats count()",
		},
		{
			name: "simple stats request with time field",
			expr: "_time:1s | stats count()",
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "_time:1s | stats count()",
		},
		{
			name: "time field after the first pipe",
			expr: "host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:1s, host) count() logs",
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "_time:[1732320000, 1732492800] host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:1s, host) count() logs",
		},
		{
			name: "time field present in the first part of the expression",
			expr: "_time:5s host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:$__range, host) count() logs",
			timeRange: backend.TimeRange{
				From: time.Date(2024, 11, 23, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 11, 25, 0, 0, 0, 0, time.UTC),
			},
			want: "_time:5s host:~'^$host$' and compose_project:~'^$compose_project$' and compose_service:~'^$compose_service$' and $log_query  | stats by (_time:$__range, host) count() logs",
		},
		{
			name: "complex query with pipes and time field in stats",
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
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := AddTimeFieldWithRange(tt.expr, tt.timeRange); got != tt.want {
				t.Errorf("AddTimeFieldWithRange() = %v, want %v", got, tt.want)
			}
		})
	}
}
