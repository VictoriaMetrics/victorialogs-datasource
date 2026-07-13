import { CoreApp, DataFrame, DataQueryRequest, FieldType, TimeRange, rangeUtil } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { escapeLabelValueInSelector } from '../../../../languageUtils';
import { calculateVolumeStep } from '../../../../logsVolumeLegacy';
import { addLabelToQuery, isStreamKey, normalizeKey } from '../../../../modifyQuery';
import { AdHocFilter, Query, QueryType } from '../../../../types';
import { applyPatternFilters, PatternFilter } from '../patterns/patternFilters';

/** Page size shared by every paginated breakdown list (value rows, field cards, patterns table) */
export const BREAKDOWN_PAGE_SIZE = 20;
export const VALUE_LOGS_SAMPLE_LIMIT = 50;
export const LOGS_TAB_SAMPLE_LIMIT = 100;
export const PATTERNS_LIMIT = 100;
/** Cap of the field-values table list; one extra row is requested to detect server truncation */
export const FIELD_VALUES_LIMIT = 100;
/** Every Nth log feeds the patterns list — collapse_nums over the full selection is the drawer's most expensive computation */
export const PATTERNS_SAMPLE_FACTOR = 10;
export const FIELD_HITS_LIMIT = 100;
// row charts are ~300-500px wide — far narrower than the full-width main volume chart, so
// fewer buckets keep bars readable instead of rendering LOGS_VOLUME_BARS-worth of hairlines
export const DRILLDOWN_ROW_BARS = 50;

export interface FieldValueFrames {
  value: string;
  total: number;
  frames: DataFrame[];
}

/**
 * Builds the LogsQL query narrowing the field/value lookup endpoints (field_names,
 * field_values, stream_field_names) to the drawer's current selection: the filter
 * chips folded in as filters, plus the pattern-filter pipe chain. The editor's own
 * expression is deliberately NOT part of it — the drilldown works as if expr were `*`.
 * `excludeKey` drops filters on one key, so a value lookup for that key still offers
 * alternatives to an already-selected value
 */
export function buildLookupQuery(
  datasource: VictoriaLogsDatasource,
  filters: AdHocFilter[],
  patternFilters: PatternFilter[],
  excludeKey?: string
): string {
  const applicable = excludeKey ? filters.filter((f) => f.key !== excludeKey) : filters;
  // same recipe as the datasource's private buildNarrowingQuery: fold filters into a
  // query expression and resolve template variables before hitting the VL endpoint
  const base = datasource.interpolateString(datasource.getExtraFilters(applicable) ?? '').trim() || '*';
  return applyPatternFilters(base, patternFilters);
}

/** Builds a DataQueryRequest for drilldown queries executed outside the panel query flow */
export function buildDrilldownRequest(
  targets: Query[],
  range: TimeRange,
  requestId: string,
  app?: CoreApp
): DataQueryRequest<Query> {
  const interval = rangeUtil.calculateInterval(range, 1);
  return {
    app: app ?? CoreApp.Unknown,
    interval: interval.interval,
    intervalMs: interval.intervalMs,
    range,
    requestId,
    scopedVars: {},
    startTime: Date.now(),
    targets,
    timezone: 'browser',
  };
}

/** Builds a hits query grouping log volume by the given fields */
export function buildFieldHitsQuery(query: Query, range: TimeRange, fields: string[]): Query {
  return {
    ...query,
    queryType: QueryType.Hits,
    fields,
    fieldsLimit: FIELD_HITS_LIMIT,
    step: `${calculateVolumeStep(range, DRILLDOWN_ROW_BARS)}s`,
    hide: false,
    refId: `drilldown-hits-${fields[0]}`,
  };
}

/** Builds the fast patterns-list query: sampled collapse_nums + top over collapsed messages */
export function buildPatternsListQuery(query: Query): Query {
  return {
    ...query,
    // sampling makes the list ~5x faster on large installations; the resulting hits are
    // ≈ 1/PATTERNS_SAMPLE_FACTOR of the real counts (rendered as "~N" until the exact
    // per-pattern volume queries replace them). One extra row detects server truncation
    expr: `${query.expr} | sample ${PATTERNS_SAMPLE_FACTOR} | collapse_nums prettify | top ${PATTERNS_LIMIT + 1} by (_msg)`,
    queryType: QueryType.Instant,
    maxLines: PATTERNS_LIMIT + 1,
    hide: false,
    refId: 'drilldown-patterns-list',
  };
}

/**
 * Builds the field-values list query: exact top values with counts via `top by (field)`.
 * The indexed field_values endpoint is NOT used here — when a field has more unique
 * values than the requested limit, it returns an arbitrary subset with zeroed hits
 */
export function buildFieldValuesListQuery(query: Query, field: string): Query {
  return {
    ...query,
    // one extra row detects server truncation
    expr: `${query.expr} | top ${FIELD_VALUES_LIMIT + 1} by (${normalizeKey(field)})`,
    queryType: QueryType.Instant,
    maxLines: FIELD_VALUES_LIMIT + 1,
    hide: false,
    refId: `drilldown-values-list-${field}`,
  };
}

/** Builds the per-value volume query behind a field-values table row — hits for `field = value`, grouped by the level fields so the sparkline can be level-stacked */
export function buildValueVolumeQuery(
  query: Query,
  field: string,
  value: string,
  levelFields: string[],
  range: TimeRange,
  refIdSuffix: number
): Query {
  // a _stream value is a `{...}` selector inserted raw by addLabelToQuery — escaping its
  // inner quotes would produce an invalid stream filter
  const escapedValue = isStreamKey(field) ? value : escapeLabelValueInSelector(value);
  return {
    ...query,
    expr: addLabelToQuery(query.expr, { key: field, value: escapedValue, operator: '=' }),
    queryType: QueryType.Hits,
    fields: levelFields,
    fieldsLimit: FIELD_HITS_LIMIT,
    step: `${calculateVolumeStep(range, DRILLDOWN_ROW_BARS)}s`,
    hide: false,
    // per-row suffix — parallel requests sharing a requestId get cancelled by Grafana
    refId: `drilldown-value-volume-${refIdSuffix}`,
  };
}

/** Builds the per-pattern volume query behind a row's sparkline — a single hits series whose sum is the pattern's exact count */
export function buildPatternVolumeQuery(query: Query, pattern: string, range: TimeRange, refIdSuffix: number): Query {
  const escapedPattern = escapeLabelValueInSelector(pattern);
  return {
    ...query,
    expr: `${query.expr} | filter pattern_match_full("${escapedPattern}")`,
    queryType: QueryType.Hits,
    fields: [],
    step: `${calculateVolumeStep(range, DRILLDOWN_ROW_BARS)}s`,
    hide: false,
    // per-row suffix: the visible rows query in parallel, and Grafana cancels in-flight
    // requests that share a requestId — identical ids would leave only the last row alive
    refId: `drilldown-pattern-volume-${refIdSuffix}`,
  };
}

/** Builds a sample-logs query for one collapsed pattern — pattern_match_full matches the collapsed shape in place, so the original _msg needs no restoring */
export function buildPatternLogsQuery(query: Query, pattern: string, refIdSuffix: number): Query {
  const escapedPattern = escapeLabelValueInSelector(pattern);
  return {
    ...query,
    // a filter pipe rather than a plain filter — query.expr may already contain pipes
    expr: `${query.expr} | filter pattern_match_full("${escapedPattern}") | sort by (_time) desc`,
    queryType: QueryType.Instant,
    maxLines: VALUE_LOGS_SAMPLE_LIMIT,
    hide: false,
    refId: `drilldown-pattern-logs-${refIdSuffix}`,
  };
}

/** Builds a raw-logs query for the drill-in Logs tab — the query's own filters (adHocFilters) already narrow it to the selected value */
export function buildRawLogsQuery(query: Query): Query {
  return {
    ...query,
    // addSortPipeToQuery in datasource.query() skips drilldown requests (app=CoreApp.Unknown), so
    // the sort must be appended here — otherwise the backend's unordered `limit` returns arbitrary rows
    expr: `${query.expr} | sort by (_time) desc`,
    queryType: QueryType.Instant,
    maxLines: LOGS_TAB_SAMPLE_LIMIT,
    hide: false,
    refId: 'drilldown-raw-logs',
  };
}

/** Builds a raw-logs query for one field value sample shown next to its volume chart */
export function buildValueLogsQuery(query: Query, field: string, value: string, refIdSuffix: number): Query {
  // a _stream value is a `{...}` selector inserted raw by addLabelToQuery — escaping its
  // inner quotes would produce an invalid stream filter
  const escapedValue = isStreamKey(field) ? value : escapeLabelValueInSelector(value);
  return {
    ...query,
    // addSortPipeToQuery in datasource.query() skips drilldown requests (app=CoreApp.Unknown), so
    // the sort must be appended here — otherwise the backend's unordered `limit` returns arbitrary rows
    expr: `${addLabelToQuery(query.expr, { key: field, value: escapedValue, operator: '=' })} | sort by (_time) desc`,
    queryType: QueryType.Instant,
    maxLines: VALUE_LOGS_SAMPLE_LIMIT,
    hide: false,
    refId: `drilldown-logs-${refIdSuffix}`,
  };
}

/** Groups multi-field hits frames by the given field's value, sorted by total hits desc; all values are kept unless a `limit` is given — display-side pagination bounds the rendering */
export function groupHitsByFieldValue(
  frames: DataFrame[],
  field: string,
  limit = Number.POSITIVE_INFINITY
): { top: FieldValueFrames[]; totalValues: number; serverTruncated: boolean } {
  const groups = new Map<string, FieldValueFrames>();
  // VictoriaLogs' `fields_limit` bounds the number of unique (field,level,...) tuples, not field
  // values — hits that don't fit are merged into a remainder series with no labels at all. That
  // series carries real hits but can't be attributed to any value, so it's dropped from the
  // grouping and instead reported as `serverTruncated` for an honest "N of M+" note upstream
  let serverTruncated = false;
  for (const frame of frames) {
    const valueField = frame.fields.find((f) => f.type === FieldType.number);
    if (!valueField) {
      continue;
    }
    const labels = valueField.labels;
    if (!labels || Object.keys(labels).length === 0) {
      serverTruncated = true;
      continue;
    }
    const value = labels[field];
    if (value === undefined) {
      continue;
    }
    const total = valueField.values.reduce((acc: number, v) => acc + (v ?? 0), 0);
    const group = groups.get(value) ?? { value, total: 0, frames: [] };
    group.total += total;
    group.frames.push(frame);
    groups.set(value, group);
  }
  const all = Array.from(groups.values()).sort((a, b) => b.total - a.total);
  return { top: all.slice(0, limit), totalValues: all.length, serverTruncated };
}
