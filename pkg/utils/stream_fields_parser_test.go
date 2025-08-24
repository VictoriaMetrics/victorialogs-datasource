package utils

import (
	"reflect"
	"testing"
)

func TestParseStreamFields(t *testing.T) {
	type opts struct {
		streamFields string
		want         []StreamField
		wantErr      bool
	}
	f := func(opts opts) {
		got, err := ParseStreamFields(opts.streamFields)
		if (err != nil) != opts.wantErr {
			t.Errorf("ParseStreamFields() error = %#v, wantErr %#v", err, opts.wantErr)
			return
		}
		if !reflect.DeepEqual(got, opts.want) {
			t.Errorf("ParseStreamFields() got = %#v, want %#v", got, opts.want)
		}
	}

	// empty
	o := opts{
		want: []StreamField(nil),
	}
	f(o)

	// incorrect stream field
	o = opts{
		streamFields: `{"a":1}`,
		want:         []StreamField(nil),
		wantErr:      true,
	}
	f(o)

	// empty value field
	o = opts{
		streamFields: `{b=""}`,
		want:         []StreamField(nil),
		wantErr:      true,
	}
	f(o)

	// incorrect value field without quotes
	o = opts{
		streamFields: `{b=a}`,
		want:         []StreamField(nil),
		wantErr:      true,
	}
	f(o)

	// incorrect label field
	o = opts{
		streamFields: `{=a"}`,
		want:         []StreamField(nil),
		wantErr:      true,
	}
	f(o)

	// both label and value in the quotes
	o = opts{
		streamFields: `{"a=b"}`,
		want:         []StreamField(nil),
		wantErr:      true,
	}
	f(o)

	// correct stream field
	o = opts{
		streamFields: `{a="b"}`,
		want: []StreamField{{
			Label: "a",
			Value: "b",
		}},
	}
	f(o)

	// many stream fields correct stream field
	o = opts{
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
	}
	f(o)

	// contains spaces
	o = opts{
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
	}
	f(o)

	// include comma inside value
	o = opts{
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
	}
	f(o)

	// include equal sign inside value
	o = opts{
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
	}
	f(o)

	// all labels with dots
	o = opts{
		streamFields: `{a.b.c="d"}`,
		want: []StreamField{
			{
				Label: "a.b.c",
				Value: "d",
			},
		},
	}
	f(o)

	// many labels with dots
	o = opts{
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
	}
	f(o)

	// all labels with dots and comma
	o = opts{
		streamFields: `{a.b,c,d="e"}`,
		want: []StreamField{
			{
				Label: "a.b,c,d",
				Value: "e",
			},
		},
	}
	f(o)

	// different label values
	o = opts{
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
	}
	f(o)

	// label contains spaces
	o = opts{
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
	}
	f(o)

	// empty stream field
	o = opts{
		streamFields: `{}`,
		want:         []StreamField(nil),
	}
	f(o)

	// complex stream fields with the comma inside the value
	o = opts{
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
	}
	f(o)

	// real world example
	o = opts{
		streamFields: `{process.command_args="[\"/opt/java/openjdk/bin/java\",\"-jar\",\"/app.jar\"]"}`,
		want: []StreamField{
			{
				Label: "process.command_args",
				Value: "[\"/opt/java/openjdk/bin/java\",\"-jar\",\"/app.jar\"]",
			},
		},
	}
	f(o)

	// space after the quote and before the comma
	o = opts{
		streamFields: `{process.command_args="[\"/opt/java/openjdk/bin/java\" ,\"-jar\",\"/app.jar\"]"}`,
		want: []StreamField{
			{
				Label: "process.command_args",
				Value: "[\"/opt/java/openjdk/bin/java\" ,\"-jar\",\"/app.jar\"]",
			},
		},
	}
	f(o)

	// space after the quote and before the comma for the many of them
	o = opts{
		streamFields: `{process.command_args="[\"/opt/java/openjdk/bin/java\" ,\"-jar\" ,\"/app.jar\"]"}`,
		want: []StreamField{
			{
				Label: "process.command_args",
				Value: "[\"/opt/java/openjdk/bin/java\" ,\"-jar\" ,\"/app.jar\"]",
			},
		},
	}
	f(o)

	// real world example with comma inside the value after the quotes
	o = opts{
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
	}
	f(o)

	// Escaped double-quotes
	o = opts{
		streamFields: `{peculiar="\"",job="loki.source.journal.read"}`,
		want: []StreamField{
			{
				Label: "peculiar",
				Value: `"`,
			}, {
				Label: "job",
				Value: "loki.source.journal.read",
			},
		},
	}
	f(o)

	// Escaped double-quotes
	o = opts{
		streamFields: `{peculiar="\"",job="loki.source.journal.read",name="value"}`,
		want: []StreamField{
			{
				Label: "peculiar",
				Value: `"`,
			}, {
				Label: "job",
				Value: "loki.source.journal.read",
			}, {
				Label: "name",
				Value: "value",
			},
		},
	}
	f(o)

	// Escaped backslash
	o = opts{
		streamFields: `{peculiar="\\",job="loki.source.journal.read"}`,
		want: []StreamField{
			{
				Label: "peculiar",
				Value: `\`,
			}, {
				Label: "job",
				Value: "loki.source.journal.read",
			},
		},
	}
	f(o)

	// Escaped backslash
	o = opts{
		streamFields: `{peculiar="\\",job="loki.source.journal.read",name="value"}`,
		want: []StreamField{
			{
				Label: "peculiar",
				Value: `\`,
			}, {
				Label: "job",
				Value: "loki.source.journal.read",
			}, {
				Label: "name",
				Value: "value",
			},
		},
	}
	f(o)

	// Escaped tab
	o = opts{
		streamFields: `{peculiar="\thello",job="loki.source.journal.read"}`,
		want: []StreamField{
			{
				Label: "peculiar",
				Value: "\thello",
			}, {
				Label: "job",
				Value: "loki.source.journal.read",
			},
		},
	}
	f(o)

	// Escaped tab
	o = opts{
		streamFields: `{peculiar="\thello",job="loki.source.journal.read",name="value"}`,
		want: []StreamField{
			{
				Label: "peculiar",
				Value: "\thello",
			}, {
				Label: "job",
				Value: "loki.source.journal.read",
			}, {
				Label: "name",
				Value: "value",
			},
		},
	}
	f(o)

}
