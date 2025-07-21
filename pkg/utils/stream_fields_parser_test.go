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
			name:         "label contains spaces",
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
		{
			name:         "empty stream field",
			streamFields: `{}`,
			want:         []StreamField(nil),
			wantErr:      false,
		},
		{
			name:         "complex stream fields with the comma inside the value",
			streamFields: `{a="b", c="d,e,f", g="h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z"}`,
			want: []StreamField{
				{
					Label: "a",
					Value: "b",
				},
				{
					Label: "c",
					Value: "d,e,f",
				},
				{
					Label: "g",
					Value: "h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z",
				},
			},
		},
		{
			name:         "real world example",
			streamFields: `{process.command_args="[\"/opt/java/openjdk/bin/java\",\"-jar\",\"/app.jar\"]"}`,
			want: []StreamField{
				{
					Label: "process.command_args",
					Value: "[\"/opt/java/openjdk/bin/java\",\"-jar\",\"/app.jar\"]",
				},
			},
		},
		{
			name:         "space after the quote and before the comma",
			streamFields: `{process.command_args="[\"/opt/java/openjdk/bin/java\" ,\"-jar\",\"/app.jar\"]"}`,
			want: []StreamField{
				{
					Label: "process.command_args",
					Value: "[\"/opt/java/openjdk/bin/java\" ,\"-jar\",\"/app.jar\"]",
				},
			},
		},
		{
			name:         "space after the quote and before the comma for the many of them",
			streamFields: `{process.command_args="[\"/opt/java/openjdk/bin/java\" ,\"-jar\" ,\"/app.jar\"]"}`,
			want: []StreamField{
				{
					Label: "process.command_args",
					Value: "[\"/opt/java/openjdk/bin/java\" ,\"-jar\" ,\"/app.jar\"]",
				},
			},
		},
		{
			name:         "real world example with comma inside the value after the quotes",
			streamFields: `{deployment.environment="dev",host.arch="amd64",host.name="ip-XXX.compute.internal",os.description="Linux 5.10.XXX.amzn2.x86_64",os.type="linux",process.command_args="[\"/opt/java/openjdk/bin/java\",\"-jar\",\"/app.jar\"]",process.executable.path="/opt/java/openjdk/bin/java",process.pid="1",process.runtime.description="Eclipse Adoptium OpenJDK 64-Bit Server VM XXX",process.runtime.name="OpenJDK Runtime Environment",process.runtime.version="17.0.XXX",service.instance.id="XXX",service.name="XXX",service.version="0.0.1-SNAPSHOT",telemetry.distro.name="opentelemetry-spring-boot-starter",telemetry.distro.version="2.8.0",telemetry.sdk.language="java",telemetry.sdk.name="opentelemetry",telemetry.sdk.version="1.42.1"}`,
			want: []StreamField{
				{
					Label: "deployment.environment",
					Value: "dev",
				},
				{
					Label: "host.arch",
					Value: "amd64",
				},
				{
					Label: "host.name",
					Value: "ip-XXX.compute.internal",
				},
				{
					Label: "os.description",
					Value: "Linux 5.10.XXX.amzn2.x86_64",
				},
				{
					Label: "os.type",
					Value: "linux",
				},
				{
					Label: "process.command_args",
					Value: "[\"/opt/java/openjdk/bin/java\",\"-jar\",\"/app.jar\"]",
				},
				{
					Label: "process.executable.path",
					Value: "/opt/java/openjdk/bin/java",
				},
				{
					Label: "process.pid",
					Value: "1",
				},
				{
					Label: "process.runtime.description",
					Value: "Eclipse Adoptium OpenJDK 64-Bit Server VM XXX",
				},
				{
					Label: "process.runtime.name",
					Value: "OpenJDK Runtime Environment",
				},
				{
					Label: "process.runtime.version",
					Value: "17.0.XXX",
				},
				{
					Label: "service.instance.id",
					Value: "XXX",
				},
				{
					Label: "service.name",
					Value: "XXX",
				},
				{
					Label: "service.version",
					Value: "0.0.1-SNAPSHOT",
				},
				{
					Label: "telemetry.distro.name",
					Value: "opentelemetry-spring-boot-starter",
				},
				{
					Label: "telemetry.distro.version",
					Value: "2.8.0",
				},
				{
					Label: "telemetry.sdk.language",
					Value: "java",
				},
				{
					Label: "telemetry.sdk.name",
					Value: "opentelemetry",
				},
				{
					Label: "telemetry.sdk.version",
					Value: "1.42.1",
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
