import React from "react";

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
  }
]

export const HelpfulLinks = () => (
  <>
    <h3 className="page-heading">Helpful links</h3>
    <div className="gf-form-group gf-form-inline markdown-html">
      {tips.map(t => (
        <a key={t.url}  className="gf-form-label gf-form-label--dashlink"
           href={t.url}
           target="_blank"
           rel="docs noreferrer">
          {t.title}
        </a>
      ))}
    </div>
  </>
)
