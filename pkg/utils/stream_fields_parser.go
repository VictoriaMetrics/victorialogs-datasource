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
		return nil, fmt.Errorf("_stream field must start with '{'")
	}
	if !strings.HasSuffix(streamFields, "}") {
		return nil, fmt.Errorf("_stream field must end with '}'")
	}

	streams := streamFields[1 : len(streamFields)-1]
	if len(streams) == 0 {
		return []StreamField(nil), nil
	}
	labelValuesPairs := strings.Split(streams, "\",")

	stf := make([]StreamField, 0, len(labelValuesPairs))
	for _, labelValuePair := range labelValuesPairs {
		labelValuePair = strings.TrimSpace(labelValuePair)
		if labelValuePair[0] == '"' || labelValuePair[0] == '`' {
			return nil, fmt.Errorf("_stream label can not start with quote: %q", labelValuePair)
		}
		fields := strings.SplitN(labelValuePair, "=", 2)
		if len(fields) != 2 {
			return nil, fmt.Errorf("_stream field %q must have `label=\"value\"` format", labelValuePair)
		}

		label := strings.TrimSpace(fields[0])
		if len(label) == 0 {
			return nil, fmt.Errorf("_stream field %q must have non-empty key", labelValuePair)
		}

		value := strings.TrimSpace(fields[1])
		if !strings.HasSuffix(value, `"`) && !strings.HasPrefix(value, `"`) {
			return nil, fmt.Errorf("_stream field %q must have quoted value", labelValuePair)
		}

		value = strings.Replace(value, `"`, ``, -1)
		if len(value) == 0 {
			return nil, fmt.Errorf("_stream field %q must have non-empty value", labelValuePair)
		}
		stf = append(stf, StreamField{
			Label: label,
			Value: value,
		})
	}

	return stf, nil
}
