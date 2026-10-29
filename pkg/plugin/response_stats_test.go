package plugin

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
)

func Test_getStatsResponse(t *testing.T) {
	type opts struct {
		filename string
		q        *Query
		want     func() backend.DataResponse
	}
	f := func(opts opts) {
		t.Helper()
		file, err := os.ReadFile(opts.filename)
		if err != nil {
			t.Fatalf("error reading file: %s", err)
		}

		r := io.NopCloser(bytes.NewBuffer(file))
		w := opts.want()
		resp := parseStatsResponse(r, opts.q)

		if w.Error != nil {
			if resp.Error == nil || w.Error.Error() != resp.Error.Error() {
				t.Errorf("parseStatsResponse() = %#v, want %#v", resp, w)
			}
			return
		}
		if resp.Error != nil {
			t.Fatalf("parseStatsResponse() unexpected error: %s", resp.Error)
		}

		got, err := resp.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal response: %s", err)
		}
		want, err := w.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal want response: %s", err)
		}
		if !bytes.Equal(got, want) {
			t.Fatalf("\n got value: %s, \n want value: %s", got, want)
		}
	}

	// empty response
	o := opts{
		filename: "test-data/stats_empty",
		want: func() backend.DataResponse {
			return backend.DataResponse{Frames: data.Frames{}}
		},
		q: &Query{},
	}
	f(o)

	// incorrect response
	o = opts{
		filename: "test-data/stats_incorrect_response",
		want: func() backend.DataResponse {
			return newResponseError(fmt.Errorf("failed to prepare data from response: unmarshal err json: cannot unmarshal string into Go value of type []plugin.Result; \n \"\\\"abc\\\"\""), backend.StatusInternal)
		},
		q: &Query{},
	}
	f(o)

	// correct stats response
	o = opts{
		filename: "test-data/stats_response",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			LegendFormat: "legend {{app}}",
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("legend ",
					data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1730937600, 0)}),
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": "message"}, []*float64{utils.Ptr(float64(13377))}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
				),
				data.NewFrame("legend ",
					data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1730937600, 0)}),
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": ""}, []*float64{utils.Ptr(float64(2078793288))}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
				),
			}

			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)

	// correct range response
	o = opts{
		filename: "test-data/stats_range_response",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			LegendFormat: "legend {{app}}",
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("legend ",
					data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1704067200, 0), time.Unix(1704088800, 0), time.Unix(1704110400, 0), time.Unix(1704132000, 0)}),
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": ""}, []*float64{utils.Ptr(float64(1311461)), utils.Ptr(float64(1311601)), utils.Ptr(float64(1310266)), utils.Ptr(float64(1310875))}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
				),
			}

			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)

	// response with milliseconds in timestamps
	o = opts{
		filename: "test-data/stats_response_milliseconds",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			LegendFormat: "legend {{app}}",
			Step:         "10ms",
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("legend ",
					data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{
						time.Unix(1733187134, 0),
						time.Unix(1733187134, 449999809),
					}),
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)"}, []*float64{utils.Ptr(float64(58)), utils.Ptr(float64(1))}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
				),
			}
			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)

	// correct stats response for alerting
	o = opts{
		filename: "test-data/stats_response",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			LegendFormat: "legend {{app}}",
			ForAlerting:  true,
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("",
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": "message"}, []*float64{utils.Ptr(float64(13377))}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericMulti, TypeVersion: data.FrameTypeVersion{0, 1}}),
				data.NewFrame("",
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": ""}, []*float64{utils.Ptr(float64(2078793288))}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericMulti, TypeVersion: data.FrameTypeVersion{0, 1}}),
			}

			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)

	// add interval to config
	o = opts{
		filename: "test-data/stats_response",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			LegendFormat: "legend {{app}}",
			IntervalMs:   1000,
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("legend ",
					data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1730937600, 0)}).SetConfig(&data.FieldConfig{Interval: 1000}),
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": "message"}, []*float64{utils.Ptr(float64(13377))}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
				),
				data.NewFrame("legend ",
					data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1730937600, 0)}).SetConfig(&data.FieldConfig{Interval: 1000}),
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "count(*)", "type": ""}, []*float64{utils.Ptr(float64(2078793288))}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
				),
			}

			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)

	// response with the empty value in the vector response
	o = opts{
		filename: "test-data/stats_empty_value_in_the_response",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			LegendFormat: "legend {{app}}",
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("legend ",
					data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1756992432, 0)}),
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "p95"}, []*float64{nil}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
				),
			}

			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)

	// response with the nil value in the vector response
	o = opts{
		filename: "test-data/stats_nil_value_in_the_response",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			LegendFormat: "legend {{app}}",
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("legend ",
					data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{time.Unix(1756992432, 0)}),
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "p95"}, []*float64{nil}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "legend "}),
				),
			}

			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)

	// alerting: stats query that matches no logs returns an empty value
	o = opts{
		filename: "test-data/stats_empty_value_in_the_response",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			ForAlerting: true,
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("",
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "p95"}, []*float64{nil}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericMulti, TypeVersion: data.FrameTypeVersion{0, 1}}),
			}

			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)

	// alerting: one group without a value next to a group with a value
	o = opts{
		filename: "test-data/stats_mixed_empty_value_in_the_response",
		q: &Query{
			DataQuery: backend.DataQuery{
				RefID: "A",
			},
			ForAlerting: true,
		},
		want: func() backend.DataResponse {
			frames := []*data.Frame{
				data.NewFrame("",
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "t", "app": "a"}, []*float64{nil}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericMulti, TypeVersion: data.FrameTypeVersion{0, 1}}),
				data.NewFrame("",
					data.NewField(data.TimeSeriesValueFieldName, data.Labels{"__name__": "t", "app": "b"}, []*float64{utils.Ptr(float64(1756992432))}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericMulti, TypeVersion: data.FrameTypeVersion{0, 1}}),
			}

			rsp := backend.DataResponse{}
			rsp.Frames = append(rsp.Frames, frames...)
			return rsp
		},
	}
	f(o)
}
