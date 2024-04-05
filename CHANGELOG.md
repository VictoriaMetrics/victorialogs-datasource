# Changelog

## tip

## v0.2.1

* BUGFIX: change the `metrics` flag from `false` to `true` in `plugin.json` to ensure the plugin appears in the Grafana datasource selection list.

## v0.2.0

* FEATURE: add support for variables in the query. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/5).
* FEATURE: add client-side record limit check for VictoriaLogs < v0.5.0 support. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/9).

* BUGFIX: fix a bug where a manually removed filter would persist in the query after the "Run query" button is clicked.See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/8).
* BUGFIX: fix query handling to correctly apply `_time` filter across all queries. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/12) and [this issue](https://github.com/VictoriaMetrics/VictoriaMetrics/issues/5920).
* BUGFIX: fix an issue where sometimes an empty response was returned despite having data in VictoriaLogs. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/10).
