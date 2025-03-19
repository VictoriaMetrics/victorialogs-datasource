package utils

import (
	"reflect"
	"testing"
)

func TestParseStreamFields(t *testing.T) {
	tests := []struct {
		name         string
		streamFields string
		want         []StreamField
		wantErr      bool
	}{
		{
			name:         "empty",
			streamFields: ``,
			want:         []StreamField(nil),
			wantErr:      false,
		},
		{
			name:         "incorrect stream field",
			streamFields: `{"a":1}`,
			want:         []StreamField(nil),
			wantErr:      true,
		},
		{
			name:         "empty value field",
			streamFields: `{b=""}`,
			want:         []StreamField(nil),
			wantErr:      true,
		},
		{
			name:         "incorrect value field without quotes",
			streamFields: `{b=a}`,
			want:         []StreamField(nil),
			wantErr:      true,
		},
		{
			name:         "empty label field in quotes",
			streamFields: `{""="b"}`,
			want:         []StreamField(nil),
			wantErr:      true,
		},
		{
			name:         "incorrect label field",
			streamFields: `{=a"}`,
			want:         []StreamField(nil),
			wantErr:      true,
		},
		{
			name:         "incorrect label field with a quote after",
			streamFields: `{"b""="a"}`,
			want:         []StreamField(nil),
			wantErr:      true,
		},
		{
			name:         "both label and value in the quotes",
			streamFields: `{"a=b"}`,
			want:         []StreamField(nil),
			wantErr:      true,
		},
		{
			name:         "quote after the label",
			streamFields: `{a="b""}`,
			want:         []StreamField(nil),
			wantErr:      true,
		},
		{
			name:         "correct stream field",
			streamFields: `{a="b"}`,
			want: []StreamField{{
				Label: "a",
				Value: "b",
			}},
			wantErr: false,
		},
		{
			name:         "many stream fields correct stream field",
			streamFields: `{a="b", c="e"}`,
			want: []StreamField{
				{
					Label: "a",
					Value: "b",
				},
				{
					Label: "c",
					Value: "e",
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseStreamFields(tt.streamFields)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseStreamFields() error = %#v, wantErr %#v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("ParseStreamFields() got = %#v, want %#v", got, tt.want)
			}
		})
	}
}
