package plugin

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
)

type FieldsQuery struct {
	Query string `json:"query"`
	Limit string `json:"limit"`
	Start string `json:"start"`
	End   string `json:"end"`
	Field string `json:"field"`
}

// getFieldsQueryFromRaw parses the field values query json from the raw message.
func getFieldsQueryFromRaw(data io.ReadCloser) (*FieldsQuery, error) {
	var q FieldsQuery
	if err := json.NewDecoder(data).Decode(&q); err != nil {
		return nil, fmt.Errorf("failed to parse query json: %s", err)
	}
	return &q, nil
}

func (fv *FieldsQuery) queryParams() url.Values {
	params := url.Values{}
	if fv.Query != "" {
		params.Set("query", fv.Query)
	}
	if fv.Limit != "" {
		params.Set("limit", fv.Limit)
	}
	if fv.Start != "" {
		params.Set("start", fv.Start)
	}
	if fv.End != "" {
		params.Set("end", fv.End)
	}
	if fv.Field != "" {
		params.Set("field", fv.Field)
	}
	return params
}
