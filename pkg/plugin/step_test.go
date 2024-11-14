package plugin

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

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
			if got := calculateStep(tt.baseInterval, tt.timeRange.From, tt.timeRange.To, tt.resolution); got.String() != tt.want {
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
			got, err := getIntervalFrom(tt.args.dsInterval, tt.args.queryInterval, tt.args.queryIntervalMS, tt.args.defaultInterval)
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

func Test_calculateRateInterval(t *testing.T) {
	type args struct {
		interval       time.Duration
		scrapeInterval string
	}
	tests := []struct {
		name string
		args args
		want time.Duration
	}{
		{
			name: "empty intervals",
			args: args{
				interval:       0,
				scrapeInterval: "",
			},
			want: time.Minute * 1,
		},
		{
			name: "empty scrapeInterval",
			args: args{
				interval:       time.Second * 5,
				scrapeInterval: "",
			},
			want: time.Minute * 1,
		},
		{
			name: "empty interval",
			args: args{
				interval:       0,
				scrapeInterval: "10s",
			},
			want: time.Second * 40,
		},
		{
			name: "interval lower than scrapeInterval",
			args: args{
				interval:       time.Second * 5,
				scrapeInterval: "10s",
			},
			want: time.Second * 40,
		},
		{
			name: "interval higher than scrapeInterval",
			args: args{
				interval:       time.Second * 20,
				scrapeInterval: "10s",
			},
			want: time.Second * 40,
		},
		{
			name: "wrong scrape interval",
			args: args{
				interval:       time.Second * 20,
				scrapeInterval: "a3",
			},
			want: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := calculateRateInterval(tt.args.interval, tt.args.scrapeInterval); got != tt.want {
				t.Errorf("calculateRateInterval() = %v, want %v", got, tt.want)
			}
		})
	}
}
