# Changelog

## tip

## v0.21.2

* BUGFIX: fix setting `extra_stream_filters` param to `Custom query parameters`. See [this comment](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/405#issuecomment-3420418177).
* BUGFIX: add `sort by (_time) asc/desc` pipe if logs are sorted in asc/desc order. In versions of grafana below `12.x.x`, you need to manually run the query if the sorting has been changed. See [#379](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/379).
* BUGFIX: fix the issue of overwriting the `level` label. Set the calculated level into a `detected_level` label, which is supported only in Grafana version 11.0.8 and above. See [#425](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/425).
* BUGFIX: fix interpolation of multi-value query variables by mapping `filterName:$filterVar` and `filterName:=$filterVar` to the `filerName:in("v1", ..., "vN")`. Support negative operators and stream tags(`{tag = $var}` to `{tag in($var)}`). Disallow interpolation in regexp with variables (e.g., `field:~$var`). See [#238](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/238).
* BUGFIX: fix rendering the graph with stats range queries by filling missing timestamps with null values. See [#421](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/421).

## v0.21.1

* BUGFIX: fix an issue with parsings of the logs lines when in the logs line empty `_stream` and missed `_msg` fields. See [#330](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/330).
* BUGFIX: fix applying `Custom query parameters` when querying from Grafana variables. See [#405](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/405).
* BUGFIX: fix duplication of `level` label. Keep the original `level` label as `__orig_level` for clarity and transparency if new calculated label after applying the datasource `Log Level Rules` is different from the original. See [#400](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/400).

## v0.21.0

* FEATURE: add run in vmui button. The VMUI URL can be configured in the datasource settings. If not specified, the datasource URL with the path `/select/vmui` will be used. See [#369](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/369).

* BUGFIX: fix unpredictable behavior when determining a `Max Data Points` option for a range query. See [#393](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/393).
* BUGFIX: respect user-specified `Min Interval` for a range queries. Before, the interval could have been rounded to smaller values and result in unexpected distance between datapoints on graph. See [#390](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/390).
* BUGFIX: fix an issue with the incorrect handling `option` field in the query for the `/stats` API. By the [documentation](https://docs.victoriametrics.com/victorialogs/logsql/#query-options) it should be passed at the beginning of LogsQL query. See [#389](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/389).

## v0.20.0

* FEATURE: upgrade Go builder from Go1.24.2 to Go1.25. See [Go1.25 release notes](https://tip.golang.org/doc/go1.25).
* FEATURE: add current version and changelog link to the Helpful links section.
* FEATURE: add support for multi-value operators (`one of`, `not one of`) in Ad hoc filters (available since Grafana 11.3.x). See [#293](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/293).

* BUGFIX: fix log level coloring when no custom rules are configured. See [#347](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/347).
* BUGFIX: respect adhoc filters variables. See [#361](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/361)
* BUGFIX: fix issue with concurrent map writes when performing multiple requests to the datasource. See [#363](https://github.com/VictoriaMetrics/victoriametrics-datasource/issues/363)
* BUGFIX: fix a parsing issue with quoted characters inside `_stream` fields. See [#365](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/365).
* BUGFIX: fix an issue with parsing stats response when it can be empty or have empty string or `nil` as a value. See [#374](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/374).

## v0.19.3

* BUGFIX: fix an issue with missing `_msg`, `_time` fields in the response and when `_stream` field is empty. See [#560](https://github.com/VictoriaMetrics/VictoriaLogs/issues/560) 
* BUGFIX: fix an issue with the propagating `AccountID` and `ProjectID` headers in the datasource for the `field_values` and `field_names` API calls. See [#354](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/354).

## v0.19.2

* BUGFIX: fix regression of the plugin that cause the plugin to not work with `field_values` and `field_names` queries. Fix comments after the plugin verification procedure.

## v0.19.1

* BUGFIX: upgrade `jest` library version to fix vulnerability warning.

## v0.19.0

* BREAKING: increase minimum required Grafana version to `>=10.4.0` to ensure compatibility with [`@grafana/plugin-ui`](https://github.com/grafana/plugin-ui). This drops support for older Grafana versions.

* BUGFIX: fix an issue with missing `_msg` field in the response. If `_msg` field is missed in the response now always returned as an empty string. See [#330](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/330).
* BUGFIX: fix an issue with parsing of the `_stream` field that contains commas in its value. Previously, commas in the `_stream` field values were incorrectly processed, leading to parsing errors. This has been fixed to properly handle complex string values with commas. See [#334](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/334).
* BUGFIX: fix an issue with parsing timestamp from the `_time` field if it contains nanosecond precision. Now, the plugin correctly handles timestamps with nanosecond precision in the `_time` field and do not round it, ensuring accurate time representation in logs. See [#340](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/340)

## v0.18.1

* BUGFIX: fix an issue when the additional `level` label was added if the logs level rules aren't configured. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/319).
* BUGFIX: fix an issue with loading field names when creating a variable using a variable or a regexp operator in the query. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/312).
* BUGFIX: fix an issue where ad-hoc filtering is applied incorrectly with extract pipe. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/298).

## v0.18.0

* FEATURE: improve query builder – when using AND operator, field and value selection is now narrowed. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/244).
* FEATURE: add a section to the datasource settings for tenant configuration. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/307).
* BUGFIX: fix an issue where line charts were incorrectly connecting data points across missing (null) values despite the "Connect null values" panel setting being set to "Never". See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/311).

## v0.17.0

* FEATURE: add support for configuring log level using custom rules. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/294).
* FEATURE: add support for build the freebsd/amd64. See [this pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/281). Thanks to @AlexanderThaller.
* BUGFIX: fix an issue when Grafana decides that the response is not a wide series and shows the error "input data must be a wide series but got type not (input refid)". See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/302).

## v0.16.3

* FEATURE: enabled [PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) support. See [VictoriaMetrics#8800](https://github.com/VictoriaMetrics/VictoriaMetrics/issues/8800) for details.
* BUGFIX: fix shows the original error message returned from the VictoriaLogs backend on status code 400. It should help to troubleshoot problems with query or syntax. See [this pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/287).
* BUGFIX: fix extend the `Custom query parameters` label width to fix the title. See [this pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/284)
  Thanks to @tommysitehost.
* BUGFIX: fix handle empty `_stream` field when it returns like `_stream:"{}"` from the datasource. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/237).  

## v0.16.2

* BUGFIX: properly close io.ReadCloser to avoid memory leak. See [this pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/280).

## v0.16.1

* BUGFIX: fix log context in dashboard view. See [this pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/267). 
* BUGFIX: fix parsing of `_stream` field with other than alpha-numeric characters in stream keys. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/265) and [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/254).
* BUGFIX: fix a bug where array indices were appended to log messages, resulting in incorrect log display on the dashboard. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/269).
* BUGFIX: fix Ad Hoc filter values autocomplete. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/237).
* BUGFIX: fix loading of field values for Grafana variables. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/255).

## v0.16.0

* FEATURE: implements the getLogRowContext method. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/41).
  Thanks to @Libr4rian for [this pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/247). 
* FEATURE: add support for build the linux/s390x. Extend backend build process to add more architectures. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/250).
* FEATURE: add configuration screen for Custom query parameters. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/252).
  Thanks to @tommysitehost for [this pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/256).
* BUGFIX: fix build annotation from the label field. All labels transforms to the string representation. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/188).
* BUGFIX: fix the bug with incorrect bar display on the Logs Volume chart. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/249).

## v0.15.0

* FEATURE: add configuration screen for derived fields. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/202).
  Thanks to @090809 for [the pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/231). 
* BUGFIX: fix live mode shows the first query result instead of separately requested two different results. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/229).

## v0.14.3

* BUGFIX: fix image links in public readme.

## v0.14.2

* BUGFIX: fix issue with plugin signature.

## v0.14.1

* BUGFIX: fix the sign plugin procedure for the new release. See [this PR](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/220) and See [this PR](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/221).

## v0.14.0

* FEATURE: enable plugin sign procedure for new releases. See [this PR](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/217).  

## v0.13.5

* BUGFIX: clean up the plugin codebase after the plugin verification procedure. See [this PR](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/213) and [this PR](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/214).

## v0.13.4

* BUGFIX: updated the backend plugin ID and revised the README.md file after the plugin verification procedure. See [this PR](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/208). 

## v0.13.3

* BUGFIX: fix query display text in query history to show the actual expression instead of the full query object. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/194).
* BUGFIX: fix query type switching when creating alerts in Grafana. See [this issue](https://github.com/VictoriaMetrics/victoriametrics-datasource/issues/237)
* BUGFIX: fix parsings of the datasource settings in the plugin. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/199).

## v0.13.2

* SECURITY: bump Go version to 1.23.4. See the list of issues addressed in [Go1.23.4](https://github.com/golang/go/issues?q=milestone%3AGo1.23.4+label%3ACherryPickApproved).
* SECURITY: bump golang.org/x/net to 0.33.0. See https://github.com/advisories/GHSA-w32m-9786-jp63

* FEATURE: enable to set headers for every request to the datasource. It helps to use custom headers in the Grafana to define AccountID and ProjectID if it is needed. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/85).

## v0.13.1

* FEATURE: update plugin dependencies to satisfy Grafana marketplace requirements.

* BUGFIX: filter out empty variable values in queries. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/159).

## v0.13.0

⚠️ **Breaking Change: Plugin ID Updated**  
**Update Note 1:**  
In the new version of the plugin, the plugin ID has been updated. The new plugin ID is `victoriametrics-logs-datasource`. **This is a breaking change**: Grafana will treat this as a new plugin.
- You must update the `allow_loading_unsigned_plugins` field in the `grafana.ini` or `defaults.ini` configuration file.  
  **Example:**
    ```ini  
  allow_loading_unsigned_plugins = victoriametrics-logs-datasource  
    ```
- If you are using provisioning, update the `type` field to `victoriametrics-logs-datasource` in your provisioning configuration.
- After making these changes, you must restart the Grafana server for the updates to take effect.

* FEATURE: update plugin id name to `victoriametrics-logs-datasource` to prepare the plugin for the sign procedure. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/156).

## v0.12.0

* FEATURE: add compatibility for Grafana `v10.x.x` to ensure `/select/logs/hits` displays precise logs volume on the Explore page. See [this comment](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/146#issuecomment-2533419498).

* BUGFIX: properly parse timestamps with milliseconds precision in datasource response. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/147).

## v0.11.1

* BUGFIX: fix the check for the stats pipe functions in expressions.
* BUGFIX: fix plugin loading issue in Grafana `v10.x.x`. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/149).

## v0.11.0

* FEATURE: add tooltips and info messages for query types. Now, plugin will warn about correct usage of `stats` panels and will provide more info about different query types.
* FEATURE: automatically add `_time` field if it s not present in the query for the `stats` [API call](https://docs.victoriametrics.com/victorialogs/querying/#querying-log-stats). See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/142).
* FEATURE: add support for `/select/logs/hits` to display precise logs volume on the Explore page. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/15).

* BUGFIX: fix bug with incomplete rendering of time series panels when selecting bigger time intervals.
* BUGFIX: fix a bug where the time range was reset when using query variables. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/118).
* BUGFIX: fix incorrect application of ad-hoc filters in panels. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/135).
* BUGFIX: fix replacement of multi-variables in expressions. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/109).

## v0.10.0

* FEATURE: add alerting support. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/98).
* FEATURE: implement a toggle to switch between instant and range requests. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/111).
* FEATURE: add options to configure the legend template, limit for number of log lines, and step. See [this](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/114) and [this](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/124) issues.

* BUGFIX: fix support mulit options with label values of stream-fields. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/109).

## v0.9.0

* FEATURE: Add support for the `$__range` variable in queries.  It will be transformed to the `[time_from, time_to]` in the Unix format. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/112).

* BUGFIX: show the original error message returned from the VictoriaLogs backend. It should help to troubleshoot problems with query or syntax. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/126).

## v0.8.0

* FEATURE: add support for the `/select/logsql/stats_query` and `/select/logsql/stats_query_range` API calls. This feature helps to build different panels with statistic data. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/61).

* BUGFIX: fix options sorting in variables for numerical data type. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/97).

## v0.7.0

* FEATURE: add support to display live logs by querying the tail endpoint in the datasource. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/83)

## v0.6.2

* BUGFIX: allow reading strings with arbitrary length when parsing response in stream mode. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/91).

## v0.6.1

* BUGFIX: fixed healthcheck

## v0.6.0

* FEATURE: add `limit` param for the `/field_values` request. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/75).

* BUGFIX: fix variable substitution in queries. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/77).
* BUGFIX: fixed health path for case, when url ends with trailing slash.
* BUGFIX: fix the application of filtering in queries. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/81).

## v0.5.0

* FEATURE: add support of the `$__interval` variable in queries. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/61).
  Thanks to @yincongcyincong for [the pull request](https://github.com/VictoriaMetrics/victorialogs-datasource/pull/69).

* BUGFIX: correctly pass time range filter when querying variable values. Before, time filter wasn't applied for `/field_values` and `/field_names` API calls. See [this](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/71) and [this](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/72) issues.
* BUGFIX: fix the issue with displaying incorrect subfields when requesting logs with different set of fields. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/60).

## v0.4.0

* FEATURE: make retry attempt for datasource requests if returned error is a temporary network error. See [this issue](https://github.com/VictoriaMetrics/victoriametrics-datasource/issues/193)

* BUGFIX: fix dynamic variable issue causing `this is undefined` error. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/64).
* BUGFIX: fix multi-value variable handling to properly format queries. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/65).
* BUGFIX: fix issue with special characters in variable values. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/65).

## v0.3.0

* FEATURE: add beta version of the query builder. The builder allows selecting `field names` and `field value`. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/48).
* FEATURE: add support for loading data for variables, including log field names and values. This feature allows querying `/select/logsql/field_names` for field names and `/select/logsql/field_values` for field values. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/40).

## v0.2.6

* BUGFIX: fix issue with forwarding headers from datasource to the backend or proxy. 
  It might be helpful if a user wants to use some kind of authentication. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/54)

## v0.2.5

* BUGFIX: fix bug with parsing response when time field is empty but message and labels are present.
  It happens when the user tries to show only stats number. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/45).

## v0.2.4

* BUGFIX: fix bug with parsing response when one of the field contains ANSI escape sequences. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/24).

## v0.2.3

* BUGFIX: fix bug with displaying response when one of the stream field is defined and lines are not collected. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/34).

## v0.2.2

* BUGFIX: fix bug with displaying responses with a custom set of fields. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/23).
* BUGFIX: change time range limitation from `_time` in the expression to `start` and `end` query args. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/22).

## v0.2.1

* BUGFIX: change the `metrics` flag from `false` to `true` in `plugin.json` to ensure the plugin appears in the Grafana datasource selection list.

## v0.2.0

* FEATURE: add support for variables in the query. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/5).
* FEATURE: add client-side record limit check for VictoriaLogs < v0.5.0 support. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/9).

* BUGFIX: fix a bug where a manually removed filter would persist in the query after the "Run query" button is clicked.See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/8).
* BUGFIX: fix query handling to correctly apply `_time` filter across all queries. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/12) and [this issue](https://github.com/VictoriaMetrics/VictoriaMetrics/issues/5920).
* BUGFIX: fix an issue where sometimes an empty response was returned despite having data in VictoriaLogs. See [this issue](https://github.com/VictoriaMetrics/victorialogs-datasource/issues/10).
