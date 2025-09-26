package utils

import (
	"fmt"
	"strconv"
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

	labelValuesPairs := splitStreamsToFields(streams)
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

		// Remove only the enclosing quotes, preserving any internal quotes
		unqValue, err := strconv.Unquote(value)
		if err != nil {
			return nil, fmt.Errorf("_stream field %q has invalid quoted value: %v", labelValuePair, err)
		}
		if len(unqValue) == 0 {
			return nil, fmt.Errorf("_stream field %q must have non-empty value", labelValuePair)
		}
		stf = append(stf, StreamField{
			Label: label,
			Value: unqValue,
		})
	}

	return stf, nil
}

// splitStreamsToFields parses a string of stream fields, respecting quoted values and
// only splitting on commas that separate fields. It handles quoted strings by toggling
// the `expectingComma` flag and ensures that commas within quotes are not treated as field
// separators. After closing a quote, the function expects a comma for field separation.
// The function returns a slice of strings representing individual fields.
func splitStreamsToFields(streamFields string) []string {

	var fields []string
	var currentField strings.Builder
	var inQuotes bool
	var escaping bool
	var expectingComma bool

	for i := 0; i < len(streamFields); i++ {
		char := streamFields[i]

		if char == '"' {
			if !escaping {
				inQuotes = !inQuotes
			}
			currentField.WriteByte(char)

			// After closing quote, we should be expecting a comma for field separation
			if !inQuotes {
				expectingComma = true
			}
			escaping = false
		} else if char == ',' && expectingComma {
			// Only split on commas that follow a closing quote
			field := strings.TrimSpace(currentField.String())
			fields = append(fields, field)
			currentField.Reset()
			expectingComma = false
			escaping = false
		} else {
			currentField.WriteByte(char)

			// If we encounter any non-whitespace character after a closing quote
			// that isn't a comma, we're no longer expecting a field separator
			if expectingComma && char != ' ' {
				expectingComma = false
			}
			escaping = char == '\\' && !escaping
		}
	}

	if currentField.Len() > 0 {
		field := strings.TrimSpace(currentField.String())
		fields = append(fields, field)
	}

	return fields
}
