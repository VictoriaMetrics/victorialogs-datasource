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
			name:         "incorrect label field",
			streamFields: `{=a"}`,
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
		{
			name:         "contains spaces",
			streamFields: `{ a = "b", c="d"}`,
			want: []StreamField{
				{
					Label: "a",
					Value: "b",
				},
				{
					Label: "c",
					Value: "d",
				},
			},
			wantErr: false,
		},
		{
			name:         "include comma inside value",
			streamFields: `{a="b,c", d="e"}`,
			want: []StreamField{
				{
					Label: "a",
					Value: "b,c",
				},
				{
					Label: "d",
					Value: "e",
				},
			},
			wantErr: false,
		},
		{
			name:         "include equal sign inside value",
			streamFields: `{a="b=c", d="e"}`,
			want: []StreamField{
				{
					Label: "a",
					Value: "b=c",
				},
				{
					Label: "d",
					Value: "e",
				},
			},
		},
		{
			name:         "all labels with dots",
			streamFields: `{a.b.c="d"}`,
			want: []StreamField{
				{
					Label: "a.b.c",
					Value: "d",
				},
			},
			wantErr: false,
		},
		{
			name:         "many labels with dots",
			streamFields: `{a.b.c="d", e.f.g="h"}`,
			want: []StreamField{
				{
					Label: "a.b.c",
					Value: "d",
				},
				{
					Label: "e.f.g",
					Value: "h",
				},
			},
			wantErr: false,
		},
		{
			name:         "all labels with dots and comma",
			streamFields: `{a.b,c,d="e"}`,
			want: []StreamField{
				{
					Label: "a.b,c,d",
					Value: "e",
				},
			},
		},
		{
			name:         "different label values",
			streamFields: `{a.b,c,d="e", d="f", a,.b.c.d="e"}`,
			want: []StreamField{
				{
					Label: "a.b,c,d",
					Value: "e",
				},
				{
					Label: "d",
					Value: "f",
				},
				{
					Label: "a,.b.c.d",
					Value: "e",
				},
			},
		},
		{
			name:         "different label values",
			streamFields: `{a d="e", d="f", a,.b.c.d="e"}`,
			want: []StreamField{
				{
					Label: "a d",
					Value: "e",
				},
				{
					Label: "d",
					Value: "f",
				},
				{
					Label: "a,.b.c.d",
					Value: "e",
				},
			},
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
