# Changelog

## tip

* FEATURE: add support for variables in the query. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/5).
* FEATURE: add client-side record limit check for VictoriaLogs < v0.5.0 support. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/9).

* BUGFIX: fix a bug where a manually removed filter would persist in the query after the "Run query" button is clicked.See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/8).
* BUGFIX: fix query handling to correctly apply `_time` filter across all queries. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/12) and [this issue](https://github.com/VictoriaMetrics/VictoriaMetrics/issues/5920).
