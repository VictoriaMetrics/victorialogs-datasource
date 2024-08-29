package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestQueryData(t *testing.T) {
	ds := Datasource{}

	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{RefID: "A"},
			},
		},
	)
	if err != nil {
		t.Error(err)
	}

	if len(resp.Responses) != 1 {
		t.Fatal("QueryData must return a response")
	}
}

func TestDatasourceQueryRequest(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatalf("should not be called")
	})
	c := -1
	mux.HandleFunc("/select/logsql/query", func(w http.ResponseWriter, r *http.Request) {
		c++
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST method got %s", r.Method)
		}

		switch c {
		case 0:
			w.WriteHeader(500)
		case 1:
			_, err := w.Write([]byte("123"))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
		case 2:
			_, err := w.Write([]byte(`{"_time":"acdf"}`))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
		case 3:
			_, err := w.Write([]byte(`cannot parse query []: missing query; context: []`))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
		case 4:
			_, err := w.Write([]byte(`{"_time":"2024-02-20", "_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=}"}`))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
		case 5:
			_, err := w.Write([]byte(`{"_msg":"123","_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}","_time":"2024-02-20T14:04:27Z"}`))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
		case 6:
			_, err := w.Write([]byte(`{"_msg":"123","_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}","_time":"2024-02-20T14:04:27Z", "job": "vlogs"}`))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
		}
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	ctx := context.Background()
	settings := backend.DataSourceInstanceSettings{
		URL:      srv.URL,
		JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
	}

	instance, err := NewDatasource(ctx, settings)
	if err != nil {
		t.Fatalf("unexpected %s", err)
	}

	datasource := instance.(*Datasource)

	expErr := func(ctx context.Context, err string) {
		rsp, gotErr := datasource.QueryData(ctx, &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					JSON: []byte(`{
    "datasourceId":27,
	"expr":".*",
	"intervalMs":5000,
	"key":"Q-454d975d-e32a-4aa4-9d65-056924caef4b-0",
	"legendFormat":"",
	"maxDataPoints":984,
	"maxLines":1000,
	"queryType":"range",
	"refId":"A"
}`),
				},
			},
		})
		response := rsp.Responses["A"]
		if response.Error == nil {
			t.Fatalf("expected %v got nil", err)
		}

		if !strings.Contains(response.Error.Error(), err) {
			t.Fatalf("expected err %q; got %q", err, gotErr)
		}
	}

	expErr(ctx, "got unexpected response status code: 500")                                                                                                                    // 0
	expErr(ctx, "error get object from decoded response: value doesn't contain object; it contains number")                                                                    // 1
	expErr(ctx, "error parse time from _time field: cannot parse acdf: cannot parse duration \"acdf\"")                                                                        // 2
	expErr(ctx, "error decode response: cannot parse JSON: cannot parse number: unexpected char: \"c\"; unparsed tail: \"cannot parse query []: missing query; context: []\"") // 3
	expErr(ctx, "StringExpr: unexpected token \"}\"; want \"string\"; unparsed data: \"}")                                                                                     // 4

	// 5
	queryJSON := []byte(`{
    "datasourceId":27,
	"expr":".*",
	"intervalMs":5000,
	"key":"Q-454d975d-e32a-4aa4-9d65-056924caef4b-0",
	"legendFormat":"",
	"maxDataPoints":984,
	"maxLines":1000,
	"queryType":"range",
	"refId":"A"
}`)
	var q Query
	if err := json.Unmarshal(queryJSON, &q); err != nil {
		t.Fatalf("error parse query %s", err)
	}
	rsp, gotErr := datasource.QueryData(ctx, &backend.QueryDataRequest{Queries: []backend.DataQuery{
		{
			RefID: "A",
			JSON:  queryJSON,
		},
	},
	})
	if gotErr != nil {
		t.Fatalf("unexpected %s", gotErr)
	}

	response := rsp.Responses["A"]
	if len(response.Frames) != 1 {
		t.Fatalf("expected 1 frame got %d in %+v", len(response.Frames), response.Frames)
	}

	dataReponse := func() backend.DataResponse {
		labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
		labelsField.Name = gLabelsField

		timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
		timeFd.Name = gTimeField

		lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
		lineField.Name = gLineField

		timeFd.Append(time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC))

		lineField.Append("123")

		labels := data.Labels{
			"application": "logs-benchmark-Apache.log-1708437847",
			"hostname":    "e28a622d7792",
		}

		b, _ := labelsToJSON(labels)

		labelsField.Append(b)
		frame := data.NewFrame("", timeFd, lineField, labelsField)

		rsp := backend.DataResponse{}
		frame.Meta = &data.FrameMeta{}
		rsp.Frames = append(rsp.Frames, frame)

		return rsp
	}

	expected := dataReponse()

	for i, frame := range response.Frames {
		d, err := frame.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal response frames %s", err)
		}
		exd, err := expected.Frames[i].MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal expected frames %s", err)
		}

		if !bytes.Equal(d, exd) {
			t.Fatalf("unexpected metric %s want %s", d, exd)
		}
	}

	// 6
	queryJSON = []byte(`{
    "datasourceId":27,
	"expr":".*",
	"intervalMs":5000,
	"key":"Q-454d975d-e32a-4aa4-9d65-056924caef4b-0",
	"legendFormat":"",
	"maxDataPoints":984,
	"maxLines":1000,
	"queryType":"range",
	"refId":"A"
}`)

	if err := json.Unmarshal(queryJSON, &q); err != nil {
		t.Fatalf("error parse query %s", err)
	}
	rsp, gotErr = datasource.QueryData(ctx, &backend.QueryDataRequest{Queries: []backend.DataQuery{
		{
			RefID:     "A",
			QueryType: instantQueryPath,
			JSON:      queryJSON,
		},
	},
	})
	if gotErr != nil {
		t.Fatalf("unexpected %s", gotErr)
	}

	dataReponse = func() backend.DataResponse {
		labelsField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
		labelsField.Name = gLabelsField

		timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
		timeFd.Name = gTimeField

		lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
		lineField.Name = gLineField

		timeFd.Append(time.Date(2024, 02, 20, 14, 04, 27, 0, time.UTC))

		lineField.Append("123")

		labels := data.Labels{
			"application": "logs-benchmark-Apache.log-1708437847",
			"hostname":    "e28a622d7792",
			"job":         "vlogs",
		}

		b, _ := labelsToJSON(labels)

		labelsField.Append(b)
		frame := data.NewFrame("", timeFd, lineField, labelsField)

		rsp := backend.DataResponse{}
		frame.Meta = &data.FrameMeta{}
		rsp.Frames = append(rsp.Frames, frame)

		return rsp
	}
	expected = dataReponse()

	response = rsp.Responses["A"]

	for i, frame := range response.Frames {
		d, err := frame.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal response frames %s", err)
		}
		exd, err := expected.Frames[i].MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal expected frames %s", err)
		}

		if !bytes.Equal(d, exd) {
			t.Fatalf("unexpected metric %s want %s", d, exd)
		}
	}
}

func TestDatasourceQueryRequestWithRetry(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatalf("should not be called")
	})
	c := -1
	mux.HandleFunc("/select/logsql/query", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST method got %s", r.Method)
		}
		c++
		switch c {
		case 0:
			_, err := w.Write([]byte(`{"_msg":"123","_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}","_time":"2024-02-20T14:04:27Z"}`))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
		case 1:
			conn, _, _ := w.(http.Hijacker).Hijack()
			_ = conn.Close()
		case 2:
			_, err := w.Write([]byte(`{"_msg":"123","_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}","_time":"2024-02-20T14:04:27Z", "job": "vlogs"}`))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
		case 3:
			conn, _, _ := w.(http.Hijacker).Hijack()
			_ = conn.Close()
		case 4:
			conn, _, _ := w.(http.Hijacker).Hijack()
			_ = conn.Close()
		}
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	ctx := context.Background()
	settings := backend.DataSourceInstanceSettings{
		URL:      srv.URL,
		JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
	}

	instance, err := NewDatasource(ctx, settings)
	if err != nil {
		t.Fatalf("unexpected %s", err)
	}

	datasource := instance.(*Datasource)

	expErr := func(err string) {
		rsp, gotErr := datasource.QueryData(ctx, &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					JSON: []byte(`{
    "datasourceId":27,
	"expr":".*",
	"intervalMs":5000,
	"key":"Q-454d975d-e32a-4aa4-9d65-056924caef4b-0",
	"legendFormat":"",
	"maxDataPoints":984,
	"maxLines":1000,
	"queryType":"range",
	"refId":"A"
}`),
				},
			},
		})

		response := rsp.Responses["A"]

		if response.Error == nil {
			t.Fatalf("expected %v got nil", err)
		}

		if !strings.Contains(response.Error.Error(), err) {
			t.Fatalf("expected err %q; got %q", err, gotErr)
		}
	}

	expValue := func(v string) {
		rsp, gotErr := datasource.QueryData(ctx, &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					JSON: []byte(`{
    "datasourceId":27,
	"expr":".*",
	"intervalMs":5000,
	"key":"Q-454d975d-e32a-4aa4-9d65-056924caef4b-0",
	"legendFormat":"",
	"maxDataPoints":984,
	"maxLines":1000,
	"queryType":"range",
	"refId":"A"
}`),
				},
			},
		})

		response := rsp.Responses["A"]
		if gotErr != nil {
			t.Fatalf("unexpected %s", gotErr)
		}
		if response.Error != nil {
			t.Fatalf("unexpected error: %s", response.Error.Error())
		}
		if len(response.Frames) != 1 {
			t.Fatalf("expected 1 frame got %d", len(response.Frames))
		}
		for _, frame := range response.Frames {
			if len(frame.Fields) != 3 {
				t.Fatalf("expected 3 fields got %d", len(frame.Fields))
			}
			if frame.Fields[1].At(0) != v {
				t.Fatalf("unexpected value %v", frame.Fields[1].At(0))
			}
		}
	}

	expValue("123") // 0
	expValue("123") // 1 - fail, 2 - retry
	expErr("EOF")   // 3, 4 - retries
}
