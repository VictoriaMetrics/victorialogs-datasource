package plugin

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang/snappy"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/klauspost/compress/zstd"
)

func TestQueryData(t *testing.T) {
	mux := http.NewServeMux()
	ctx := context.Background()
	ds := NewDatasource()
	srv := httptest.NewServer(mux)
	defer srv.Close()

	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      srv.URL,
			JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
		},
	}

	resp, err := ds.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Queries: []backend.DataQuery{
			{RefID: "A", JSON: []byte(`{"expr":"*", "intervalMs":5000, "maxDataPoints":984, "maxLines":1000, "queryType":"instant", "refId":"A"}`)},
		},
	})
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
	d := NewDatasource()
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      srv.URL,
			JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
		},
	}
	expErr := func(ctx context.Context, err string) {
		rsp, gotErr := d.QueryData(ctx, &backend.QueryDataRequest{
			PluginContext: pluginCtx,
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					QueryType: "instant",
					JSON: []byte(`{
    "datasourceId":27,
	"expr":".*",
	"intervalMs":5000,
	"key":"Q-454d975d-e32a-4aa4-9d65-056924caef4b-0",
	"legendFormat":"",
	"maxDataPoints":984,
	"maxLines":1000,
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

	expErr(ctx, "failed to make http request: 500")                                                                                                                            // 0
	expErr(ctx, "error get object from decoded response: value doesn't contain object; it contains number")                                                                    // 1
	expErr(ctx, "error parse time from _time field: cannot parse acdf: cannot parse duration \"acdf\"")                                                                        // 2
	expErr(ctx, "error decode response: cannot parse JSON: cannot parse number: unexpected char: \"c\"; unparsed tail: \"cannot parse query []: missing query; context: []\"") // 3
	expErr(ctx, "_stream field \"hostname=\" must have quoted value")                                                                                                          // 4

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
	rsp, gotErr := d.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Queries: []backend.DataQuery{
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
	rsp, gotErr = d.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Queries: []backend.DataQuery{
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
	d := NewDatasource()
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      srv.URL,
			JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
		},
	}
	expErr := func(err string) {
		rsp, gotErr := d.QueryData(ctx, &backend.QueryDataRequest{
			PluginContext: pluginCtx,
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
		rsp, gotErr := d.QueryData(ctx, &backend.QueryDataRequest{
			PluginContext: pluginCtx,
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

type mockStreamSender struct {
	mx      sync.Mutex
	packets []json.RawMessage
}

func (m *mockStreamSender) Send(packet *backend.StreamPacket) error {
	m.mx.Lock()
	defer m.mx.Unlock()
	m.packets = append(m.packets, packet.Data)
	return nil
}

func (m *mockStreamSender) GetStream() []json.RawMessage {
	m.mx.Lock()
	defer m.mx.Unlock()
	return m.packets
}

func (m *mockStreamSender) Reset() error {
	m.mx.Lock()
	defer m.mx.Unlock()
	m.packets = make([]json.RawMessage, 0)
	return nil
}

func TestDatasourceStreamQueryRequest(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatalf("should not be called")
	})
	c := -1
	mux.HandleFunc("/select/logsql/tail", func(w http.ResponseWriter, r *http.Request) {
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
	d := NewDatasource()
	packetSender := &mockStreamSender{packets: []json.RawMessage{}}
	sender := backend.NewStreamSender(packetSender)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      srv.URL,
			JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
		},
	}
	expErr := func(ctx context.Context, e string) {
		_ = packetSender.Reset()
		_, _ = d.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
			PluginContext: pluginCtx,
			Path:          "request_id/ref_id",
		})
		err := d.RunStream(ctx, &backend.RunStreamRequest{
			PluginContext: pluginCtx,
			Path:          "request_id/ref_id",
			Data: json.RawMessage(`
{
  "datasource": {
    "type": "victoriametrics-logs-datasource",
    "uid": "a1c68f07-1354-4dd1-97bd-3bc49e06f03e"
  },
  "editorMode": "code",
  "expr": "*",
  "maxLines": 1000,
  "queryType": "range",
  "refId":"A"
}`),
		}, sender)
		if e != "" {
			// we expect an error
			if err == nil {
				t.Fatalf("expected %v got nil", err)
			}
			if !strings.Contains(err.Error(), e) {
				t.Fatalf("expected err %q; got %q", e, err.Error())
			}
		}
	}

	expErr(ctx, "failed to make http request: 500")                                                                                                                            // 0
	expErr(ctx, "error get object from decoded response: value doesn't contain object; it contains number")                                                                    // 1
	expErr(ctx, "error parse time from _time field: cannot parse acdf: cannot parse duration \"acdf\"")                                                                        // 2
	expErr(ctx, "error decode response: cannot parse JSON: cannot parse number: unexpected char: \"c\"; unparsed tail: \"cannot parse query []: missing query; context: []\"") // 3
	expErr(ctx, "_stream field \"hostname=\" must have quoted value")                                                                                                          // 4

	expErr(ctx, "") // 5
	dataResponse := func() *data.Frame {
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
		frame.Meta = &data.FrameMeta{PreferredVisualization: logsVisualisation}

		return frame
	}

	expected := dataResponse()

	for len(packetSender.GetStream()) == 0 {
		time.Sleep(10 * time.Millisecond)
	}

	stream := packetSender.GetStream()

	for _, message := range stream {
		got, err := message.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal response frames %s", err)
		}
		exp, err := expected.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal expected frames %s", err)
		}
		if !bytes.Equal(got, exp) {
			t.Fatalf("unexpected metric %s want %s", got, exp)
		}
	}

	expErr(ctx, "") // 6
	dataResponse = func() *data.Frame {
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
		frame.Meta = &data.FrameMeta{PreferredVisualization: logsVisualisation}
		return frame
	}

	expected = dataResponse()

	for len(packetSender.GetStream()) == 0 {
		time.Sleep(10 * time.Millisecond)
	}

	stream = packetSender.GetStream()

	for _, message := range stream {
		got, err := message.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal response frames %s", err)
		}
		exp, err := expected.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal expected frames %s", err)
		}
		if !bytes.Equal(got, exp) {
			t.Fatalf("unexpected metric %s want %s", got, exp)
		}
	}

}

func TestDatasourceStreamRequestWithRetry(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatalf("should not be called")
	})
	c := -1
	mux.HandleFunc("/select/logsql/tail", func(w http.ResponseWriter, r *http.Request) {
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
	d := NewDatasource()
	packetSender := &mockStreamSender{packets: []json.RawMessage{}}
	sender := backend.NewStreamSender(packetSender)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      srv.URL,
			JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
		},
	}
	expErr := func(e string) {
		err := d.RunStream(ctx, &backend.RunStreamRequest{
			PluginContext: pluginCtx,
			Path:          "request_id/ref_id",
			Data: json.RawMessage(`
	{
	  "datasource": {
	    "type": "victoriametrics-logs-datasource",
	    "uid": "a1c68f07-1354-4dd1-97bd-3bc49e06f03e"
	  },
	  "editorMode": "code",
	  "expr": "*",
	  "maxLines": 1000,
	  "queryType": "range",
	  "refId":"A"
	}`),
		}, sender)
		if err == nil {
			t.Fatalf("expected %v got nil", e)
		}

		if !strings.Contains(err.Error(), e) {
			t.Fatalf("expected err %q; got %q", e, err)
		}
	}

	expValue := func() {
		_ = packetSender.Reset()
		_, _ = d.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
			PluginContext: pluginCtx,
			Path:          "request_id/ref_id",
		})
		err := d.RunStream(ctx, &backend.RunStreamRequest{
			PluginContext: pluginCtx,
			Path:          "request_id/ref_id",
			Data: json.RawMessage(`
{
  "datasource": {
    "type": "victoriametrics-logs-datasource",
    "uid": "a1c68f07-1354-4dd1-97bd-3bc49e06f03e"
  },
  "editorMode": "code",
  "expr": "*",
  "maxLines": 1000,
  "queryType": "range",
  "refId":"A"
}`),
		}, sender)
		if err != nil {
			t.Fatalf("unexpected %s", err)
		}
	}

	expValue() // 0
	dataResponse := func() *data.Frame {
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
		frame.Meta = &data.FrameMeta{PreferredVisualization: logsVisualisation}

		return frame
	}

	expected := dataResponse()

	for len(packetSender.GetStream()) == 0 {
		time.Sleep(10 * time.Millisecond)
	}

	stream := packetSender.GetStream()

	for _, message := range stream {
		got, err := message.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal response frames %s", err)
		}
		exp, err := expected.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal expected frames %s", err)
		}
		if !bytes.Equal(got, exp) {
			t.Fatalf("unexpected metric %s want %s", got, exp)
		}
	}

	expValue() // 1 - fail, 2 - retry
	dataResponse = func() *data.Frame {
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
		frame.Meta = &data.FrameMeta{PreferredVisualization: logsVisualisation}
		return frame
	}

	expected = dataResponse()

	for len(packetSender.GetStream()) == 0 {
		time.Sleep(10 * time.Millisecond)
	}

	stream = packetSender.GetStream()

	for _, message := range stream {
		got, err := message.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal response frames %s", err)
		}
		exp, err := expected.MarshalJSON()
		if err != nil {
			t.Fatalf("error marshal expected frames %s", err)
		}
		if !bytes.Equal(got, exp) {
			t.Fatalf("unexpected metric %s want %s", got, exp)
		}
	}

	expErr("EOF") // 3, 4 - retries
}

func TestDatasourceStreamTailProcess(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatalf("should not be called")
	})

	mux.HandleFunc("/select/logsql/tail", func(w http.ResponseWriter, _ *http.Request) {
		// we send 3 messages with 20ms delay
		// simulate tail stream response
		for i := 0; i < 3; i++ {
			_, err := w.Write([]byte(`{"_msg":"123","_stream":"{application=\"logs-benchmark-Apache.log-1708437847\",hostname=\"e28a622d7792\"}","_time":"2024-02-20T14:04:27Z"}` + "\n"))
			if err != nil {
				t.Fatalf("error write reposne: %s", err)
			}
			time.Sleep(20 * time.Millisecond)
		}
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	ctx := context.Background()
	d := NewDatasource()
	packetSender := &mockStreamSender{packets: []json.RawMessage{}}
	sender := backend.NewStreamSender(packetSender)
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      srv.URL,
			JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
		},
	}
	_, _ = d.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
		PluginContext: pluginCtx,
		Path:          "request_id/ref_id",
	})
	if err := d.RunStream(ctx, &backend.RunStreamRequest{
		PluginContext: pluginCtx,
		Path:          "request_id/ref_id",
		Data: json.RawMessage(`
{
  "datasource": {
    "type": "victoriametrics-logs-datasource",
    "uid": "a1c68f07-1354-4dd1-97bd-3bc49e06f03e"
  },
  "editorMode": "code",
  "expr": "*",
  "maxLines": 1000,
  "queryType": "range",
  "refId":"A"
}`),
	}, sender); err != nil {
		t.Fatalf("unexpected %s", err)
	}

	// we send 3 messages with 20ms delay
	// we should wait for 100ms to get all messages
	time.Sleep(100 * time.Millisecond)
	got := packetSender.GetStream()

	if len(got) != 3 {
		t.Fatalf("expected 2 got %d", len(got))
	}
}

func TestDatasource_checkAlertingRequest(t *testing.T) {
	type opts struct {
		headers map[string]string
		want    bool
		wantErr bool
	}
	f := func(opts opts) {
		t.Helper()
		got, err := checkAlertingRequest(opts.headers)
		if (err != nil) != opts.wantErr {
			t.Errorf("checkAlertingRequest() error = %v, wantErr %v", err, opts.wantErr)
			return
		}
		if got != opts.want {
			t.Errorf("checkAlertingRequest() got = %v, want %v", got, opts.want)
		}
	}

	// no alerting header
	o := opts{
		headers: map[string]string{},
	}
	f(o)

	// alerting header
	o = opts{
		headers: map[string]string{"FromAlert": "true"},
		want:    true,
	}
	f(o)

	// invalid alerting header
	o = opts{
		headers: map[string]string{"FromAlert": "invalid"},
		wantErr: true,
	}
	f(o)

	// false alerting header
	o = opts{
		headers: map[string]string{"FromAlert": "false"},
	}
	f(o)

	// irrelevant header
	o = opts{
		headers: map[string]string{"SomeOtherHeader": "true"},
	}
	f(o)
}

func TestDatasourceQueryDataRace(t *testing.T) {
	ctx := context.Background()
	ds := NewDatasource()
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			URL:      "http://localhost", // Use a valid test server if needed
			JSONData: []byte(`{"httpMethod":"POST","customQueryParameters":""}`),
		},
	}

	var queries []backend.DataQuery
	for i := 0; i < 20; i++ {
		queries = append(queries, backend.DataQuery{
			RefID:     fmt.Sprintf("A%d", i),
			QueryType: instantQueryPath,
			JSON:      []byte(`{"refId":"A","instant":true,"range":false,"expr":"sum(vm_http_request_total)"}`),
		})
	}

	_, err := ds.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Queries:       queries,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGetBaseVMUIURL(t *testing.T) {
	tests := []struct {
		name     string
		settings DataSourceInstanceSettings
		want     string
		wantErr  bool
	}{
		{
			name: "Valid VMUIURL directly given",
			settings: DataSourceInstanceSettings{
				VMUIURL: "http://vmuiurl/vmui",
			},
			want:    "http://vmuiurl/vmui",
			wantErr: false,
		},
		{
			name: "Base URL with valid appended path",
			settings: DataSourceInstanceSettings{
				URL: "http://url",
			},
			want:    "http://url/select/vmui",
			wantErr: false,
		},
		{
			name: "Invalid base URL format",
			settings: DataSourceInstanceSettings{
				URL: ":/invalid-url",
			},
			want:    "",
			wantErr: true,
		},
		{
			name: "Empty URLs",
			settings: DataSourceInstanceSettings{
				URL:     "",
				VMUIURL: "",
			},
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := getBaseVMUIURL(tt.settings)
			if (err != nil) != tt.wantErr {
				t.Errorf("getBaseVMUIURL() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("getBaseVMUIURL() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseMultitenancyHeaders(t *testing.T) {
	tests := []struct {
		name     string
		jsonData string
		want     MultitenancyHeaders
		wantErr  bool
	}{
		{
			name:     "Default values when headers are missing",
			jsonData: `{}`,
			want: MultitenancyHeaders{
				AccountID: "0",
				ProjectID: "0",
			},
			wantErr: false,
		},
		{
			name:     "Valid string values",
			jsonData: `{"multitenancyHeaders": {"AccountID": "43", "ProjectID": "4"}}`,
			want: MultitenancyHeaders{
				AccountID: "43",
				ProjectID: "4",
			},
			wantErr: false,
		},
		{
			name:     "Numeric values (float64 from json)",
			jsonData: `{"multitenancyHeaders": {"AccountID": 100, "ProjectID": 200}}`,
			want: MultitenancyHeaders{
				AccountID: "100",
				ProjectID: "200",
			},
			wantErr: false,
		},
		{
			name:     "Mixed types and extra headers",
			jsonData: `{"multitenancyHeaders": {"AccountID": 123, "ProjectID": "abc", "Custom": "val"}}`,
			want: MultitenancyHeaders{
				AccountID: "123",
				ProjectID: "0",
			},
			wantErr: true,
		},
		{
			name:     "Invalid JSON",
			jsonData: `{invalid}`,
			want: MultitenancyHeaders{
				AccountID: "0",
				ProjectID: "0",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			settings := backend.DataSourceInstanceSettings{
				JSONData: []byte(tt.jsonData),
			}
			got, err := parseMultitenancyHeaders(settings)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseMultitenancyHeaders() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if got != tt.want {
					t.Errorf("parseMultitenancyHeaders() got %v, want %v", got, tt.want)
				}
			}
		})
	}
}

func TestVLAPIQuery_ContentEncoding(t *testing.T) {
	expectedJSON := `{"status":"success","data":{"resultType":"vector","result":[]}}`

	gzipCompress := func(data []byte) []byte {
		var buf bytes.Buffer
		w := gzip.NewWriter(&buf)
		if _, err := w.Write(data); err != nil {
			t.Fatalf("failed to write gzip data: %s", err)
		}
		if err := w.Close(); err != nil {
			t.Fatalf("failed to close gzip writer: %s", err)
		}
		return buf.Bytes()
	}

	deflateCompress := func(data []byte) []byte {
		var buf bytes.Buffer
		w, err := flate.NewWriter(&buf, flate.DefaultCompression)
		if err != nil {
			t.Fatalf("failed to create deflate writer: %s", err)
		}
		if _, err := w.Write(data); err != nil {
			t.Fatalf("failed to write deflate data: %s", err)
		}
		if err := w.Close(); err != nil {
			t.Fatalf("failed to close deflate writer: %s", err)
		}
		return buf.Bytes()
	}

	zstdCompress := func(data []byte) []byte {
		var buf bytes.Buffer
		w, err := zstd.NewWriter(&buf)
		if err != nil {
			t.Fatalf("failed to create zstd writer: %s", err)
		}
		if _, err := w.Write(data); err != nil {
			t.Fatalf("failed to write zstd data: %s", err)
		}
		if err := w.Close(); err != nil {
			t.Fatalf("failed to close zstd writer: %s", err)
		}
		return buf.Bytes()
	}

	deflateDecompress := func(data []byte) ([]byte, error) {
		r := flate.NewReader(bytes.NewReader(data))
		defer r.Close()
		return io.ReadAll(r)
	}

	zstdDecompress := func(data []byte) ([]byte, error) {
		r, err := zstd.NewReader(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("failed to create zstd reader: %w", err)
		}
		defer r.Close()
		return io.ReadAll(r)
	}

	snappyCompress := func(data []byte) []byte {
		return snappy.Encode(nil, data)
	}

	snappyDecompress := func(data []byte) ([]byte, error) {
		return snappy.Decode(nil, data)
	}

	tests := []struct {
		name string
		// contentEncoding is the Content-Encoding the upstream VM server sets on its response.
		contentEncoding string
		compressBody    func([]byte) []byte
		decompressBody  func([]byte) ([]byte, error)
		// expectedEncoding is the Content-Encoding we expect the handler to proxy to the client.
		// For gzip this is "" because Go's http.Transport transparently decodes gzip responses
		// and strips the Content-Encoding header before the handler sees it.
		expectedEncoding string
	}{
		{
			name:             "no encoding",
			contentEncoding:  "",
			compressBody:     nil,
			decompressBody:   nil,
			expectedEncoding: "",
		},
		{
			name:             "gzip",
			contentEncoding:  "gzip",
			compressBody:     gzipCompress,
			decompressBody:   nil, // Go http.Transport already decompresses gzip
			expectedEncoding: "",  // Transport strips the header
		},
		{
			name:             "deflate",
			contentEncoding:  "deflate",
			compressBody:     deflateCompress,
			decompressBody:   deflateDecompress,
			expectedEncoding: "deflate",
		},
		{
			name:             "zstd",
			contentEncoding:  "zstd",
			compressBody:     zstdCompress,
			decompressBody:   zstdDecompress,
			expectedEncoding: "zstd",
		},
		{
			name:             "snappy",
			contentEncoding:  "snappy",
			compressBody:     snappyCompress,
			decompressBody:   snappyDecompress,
			expectedEncoding: "snappy",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create mock upstream VM server that returns compressed response
			mockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				body := []byte(expectedJSON)
				if tc.compressBody != nil {
					body = tc.compressBody(body)
				}
				if tc.contentEncoding != "" {
					w.Header().Set("Content-Encoding", tc.contentEncoding)
				}
				w.Header().Set("Content-Type", "application/json")
				if _, err := w.Write(body); err != nil {
					t.Errorf("failed to write mock response: %s", err)
				}
			}))
			defer mockSrv.Close()

			ds := NewDatasource()
			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					URL:      mockSrv.URL,
					JSONData: []byte(`{"httpMethod":"GET","customQueryParameters":""}`),
				},
			}

			ctx := backend.WithPluginContext(context.Background(), pluginCtx)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/field_values", nil)
			req = req.WithContext(ctx)

			rr := httptest.NewRecorder()
			ds.VLAPIQuery(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("expected status %d, got %d; body: %s", http.StatusOK, rr.Code, rr.Body.String())
			}

			// Verify Content-Encoding header is proxied correctly
			gotEncoding := rr.Header().Get("Content-Encoding")
			if gotEncoding != tc.expectedEncoding {
				t.Fatalf("expected Content-Encoding %q, got %q", tc.expectedEncoding, gotEncoding)
			}

			// Decompress the response body (as a client would) and verify it matches the original JSON
			responseBody := rr.Body.Bytes()
			if tc.decompressBody != nil {
				decompressed, err := tc.decompressBody(responseBody)
				if err != nil {
					t.Fatalf("failed to decompress response body: %s", err)
				}
				responseBody = decompressed
			}

			if string(responseBody) != expectedJSON {
				t.Fatalf("expected body:\n%s\ngot:\n%s", expectedJSON, string(responseBody))
			}
		})
	}
}
