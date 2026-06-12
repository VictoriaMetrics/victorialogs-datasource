package plugin

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/VictoriaMetrics/victorialogs-datasource/pkg/utils"
)

func parseHitsResponse(reader io.Reader) backend.DataResponse {
	var hr HitsResponse
	if err := json.NewDecoder(reader).Decode(&hr); err != nil {
		err = fmt.Errorf("failed to decode body response: %w", err)
		return newResponseError(err, backend.StatusInternal)
	}

	frames, err := hr.getDataFrames()
	if err != nil {
		err = fmt.Errorf("failed to prepare data from response: %w", err)
		return newResponseError(err, backend.StatusInternal)
	}

	return backend.DataResponse{Frames: frames}
}

// Hit represents a single hit from the query
type Hit struct {
	Fields     map[string]string `json:"fields"`
	Timestamps []string          `json:"timestamps"`
	Values     []float64         `json:"values"`
	Total      int               `json:"total"`
}

// HitsResponse represents response from the hits query
type HitsResponse struct {
	Hits []Hit `json:"hits"`
}

func (hr *HitsResponse) getDataFrames() (data.Frames, error) {
	frames := make(data.Frames, len(hr.Hits))
	for i, hit := range hr.Hits {
		if len(hit.Timestamps) != len(hit.Values) {
			return nil, fmt.Errorf("timestamps and values length mismatch: %d != %d", len(hit.Timestamps), len(hit.Values))
		}

		timeFd := data.NewFieldFromFieldType(data.FieldTypeTime, len(hit.Timestamps))
		timeFd.Name = gTimeField

		valueFd := data.NewFieldFromFieldType(data.FieldTypeFloat64, len(hit.Values))
		valueFd.Name = gValueField
		valueFd.Labels = make(data.Labels)

		for j, ts := range hit.Timestamps {
			getTime, err := utils.GetTime(ts)
			if err != nil {
				return nil, fmt.Errorf("error parse time from _time field: %s", err)
			}
			timeFd.Set(j, getTime)
		}

		for k, v := range hit.Values {
			valueFd.Set(k, v)
		}

		for key, value := range hit.Fields {
			valueFd.Labels[key] = value
			d, err := labelsToJSON(valueFd.Labels)
			if err != nil {
				return nil, fmt.Errorf("error convert labels to json: %s", err)
			}
			valueFd.Config = &data.FieldConfig{DisplayNameFromDS: string(d)}
		}

		frames[i] = data.NewFrame("", timeFd, valueFd)
	}

	return frames, nil
}
