import React from "react";

import { usePluginContext } from "@grafana/data";
import { Stack, Text } from '@grafana/ui';

const tips = [
  {
    title: "Datasource",
    url: "https://github.com/VictoriaMetrics/victorialogs-datasource",
  },
  {
    title: "VictoriaLogs",
    url: "https://docs.victoriametrics.com/victorialogs/",
  },
  {
    title: "LogsQL",
    url: "https://docs.victoriametrics.com/victorialogs/logsql/",
  },
  {
    title: "VictoriaMetrics",
    url: "https://victoriametrics.com/",
  },
];

export const HelpfulLinks = () => {
  const ctx = usePluginContext();
  const version = ctx?.meta?.info?.version;
  const changelogUrl = `https://github.com/VictoriaMetrics/victorialogs-datasource/releases/tag/v${version}`;

  return (
    <Stack direction="column" gap={2}>
      <div>
        <Text variant="h4">Helpful links</Text>
      </div>

      <div className="gf-form-group gf-form-inline markdown-html">
        {version && (
          <a
            className="gf-form-label gf-form-label--dashlink"
            href={changelogUrl}
            target="_blank"
            rel="docs noreferrer"
          >
            Release v{version}
          </a>
        )}
        {tips.map((t) => (
          <a
            key={t.url}
            className="gf-form-label gf-form-label--dashlink"
            href={t.url}
            target="_blank"
            rel="docs noreferrer"
          >
            {t.title}
          </a>
        ))}
      </div>
    </Stack>
  );
};
