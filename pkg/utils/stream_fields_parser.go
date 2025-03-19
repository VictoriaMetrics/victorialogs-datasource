package utils

import (
	"fmt"
	"strings"
)

// StreamField represents the label values pair of the
// _stream fields in the log struct
type StreamField struct {
	Label string
	Value string
}

// ParseStreamFields collect labels values pair from the _stream field
func ParseStreamFields(streamFields string) ([]StreamField, error) {
	if streamFields == "" {
		return nil, nil
	}

	if !strings.HasPrefix(streamFields, "{") {
		return nil, fmt.Errorf("_stream field must start with '{' or '}'")
	}
	if !strings.HasSuffix(streamFields, "}") {
		return nil, fmt.Errorf("_stream field must end with '}'")
	}
	if strings.HasSuffix(streamFields, `""}`) {
		return nil, fmt.Errorf("incorrect _stream fields: %s", streamFields)
	}

	// remove "{ and }" from the start and the end of the string
	streams := streamFields[1 : len(streamFields)-2]
	if len(streams) == 0 {
		return nil, fmt.Errorf("_stream fields must contain at least one '{' or '}'")
	}
	labelValuesPairs := strings.Split(streams, ",")

	stf := make([]StreamField, 0, len(labelValuesPairs))
	for _, labelValuePair := range labelValuesPairs {
		labelValuePair = strings.TrimSpace(labelValuePair)
		if labelValuePair[0] == '"' || labelValuePair[0] == '`' {
			return nil, fmt.Errorf("label can not start with quote: %q", labelValuePair)
		}
		fields := strings.Split(labelValuePair, "=")
		if len(fields) != 2 {
			return nil, fmt.Errorf("incorrect label value pair %q in _stream field must have label=\"value\" format", labelValuePair)
		}

		label := fields[0]
		if len(label) == 0 {
			return nil, fmt.Errorf("label values pair %q must have label", labelValuePair)
		}

		value := fields[1]
		if len(value) == 0 || strings.EqualFold(value, `"`) {
			return nil, fmt.Errorf("label values pair %q must have value", labelValuePair)
		}

		value = strings.Replace(value, `"`, ``, -1)
		stf = append(stf, StreamField{
			Label: label,
			Value: value,
		})
	}

	return stf, nil
}
