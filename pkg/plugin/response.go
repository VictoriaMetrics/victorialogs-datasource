package plugin

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	// VictoriaLogs field types
	messageField = "_msg"
	streamField  = "_stream"
	timeField    = "_time"

	// Grafana logs fields
	gLabelsField = "labels"
	gTimeField   = "Time"
	gLineField   = "Line"
	gValueField  = "Value"
	gIDField     = "id"

	logsVisualisation = "logs"
)

// Data contains fields
// ResultType which defines type of the query response
// Result resents json of the query response
type Data struct {
	ResultType string          `json:"resultType"`
	Result     json.RawMessage `json:"result"`
}

// Response contains fields from query response
type Response struct {
	Status      string `json:"status"`
	Data        Data   `json:"data"`
	Error       string `json:"error"`
	ForAlerting bool   `json:"-"`
}

// parseErrorResponse reads data from the reader and returns error
func parseErrorResponse(reader io.Reader) error {
	var rs Response
	if err := json.NewDecoder(reader).Decode(&rs); err != nil {
		err = fmt.Errorf("failed to decode body response: %w", err)
		return err
	}

	if rs.Status == "error" {
		return fmt.Errorf("error: %s", rs.Error)
	}

	if rs.Error == "" {
		return fmt.Errorf("got unexpected error from the datasource")
	}

	return nil
}

// parseStringResponseError reads data from the reader and returns error
func parseStringResponseError(reader io.Reader) error {
	d, err := io.ReadAll(reader)
	if err != nil {
		return fmt.Errorf("failed to read body response: %w", err)
	}
	if len(d) == 0 {
		return fmt.Errorf("got empty response from the datasource")
	}
	return fmt.Errorf("error from datasource: %s", string(d))
}

// labelsToJSON converts labels to json representation
// data.Labels when converted to JSON keep the fields sorted
func labelsToJSON(labels data.Labels) (json.RawMessage, error) {
	b, err := json.Marshal(labels)
	if err != nil {
		return nil, err
	}

	return b, nil
}
