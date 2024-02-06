package plugin

import "encoding/json"

// Data contains fields
// ResultType which defines type of the query response
// Result resents json of the query response
type Data struct {
	ResultType string          `json:"resultType"`
	Result     json.RawMessage `json:"result"`
}

// Response contains fields from query response
type Response struct {
	Status string `json:"status"`
	Data   Data   `json:"data"`
}
