import { CoreApp, DataFrame, DataQueryRequest, FieldType, TimeRange, rangeUtil } from '@grafana/data';

import { LogLevelRule } from '../../../../configuration/LogLevelRules/types';
import { VictoriaLogsDatasource } from '../../../../datasource';
import { escapeLabelValueInSelector } from '../../../../languageUtils';
import { calculateVolumeStep } from '../../../../logsVolumeLegacy';
import { addLabelToQuery, insertPipesBeforeSortClassPipe, normalizeKey } from '../../../../modifyQuery';
import { AdHocFilter, Query, QueryType } from '../../../../types';
import { serializeChipsForBackend } from '../../../../utils/query/adHocFilters';
import { usableLevelRules } from '../../../../utils/query/levelExpansion';
import { LevelGrouping } from '../../../../utils/query/levelFormatPipes';
import { splitExpression } from '../../../../utils/query/parseFromString';
import { applyPatternFilters, PatternFilter } from '../patterns/patternFilters';

/** Page size shared by every paginated breakdown list */
export const BREAKDOWN_PAGE_SIZE = 20;
export const VALUE_LOGS_SAMPLE_LIMIT = 50;
const LOGS_TAB_SAMPLE_LIMIT = 100;
export const PATTERNS_LIMIT = 100;
/** Cap of the field-values list. The queries ask for one extra row to detect server truncation */
export const FIELD_VALUES_LIMIT = 100;
/** Only every Nth log feeds the patterns list, because collapse_nums over the whole selection is the drawer's slowest computation */
export const PATTERNS_SAMPLE_FACTOR = 10;
export const FIELD_HITS_LIMIT = 100;
// a row chart is 300 to 500 pixels wide, so it needs fewer buckets than the full-width main
// volume chart. At LOGS_VOLUME_BARS the bars would render as hairlines
export const DRILLDOWN_ROW_BARS = 50;

/** Level rules the drilldown classifies with: the active ones minus drafts without a field */
export function getDrilldownLevelRules(datasource: VictoriaLogsDatasource): LogLevelRule[] {
  return usableLevelRules(datasource.getActiveLevelRules());
}

/** Total of every numeric sample across the frames, which is the hit count they represent */
export function sumFrameValues(frames: DataFrame[]): number {
  return frames.reduce(
    (acc, frame) =>
      acc +
      frame.fields
        .filter((f) => f.type === FieldType.number)
        .reduce((fieldAcc, f) => fieldAcc + f.values.reduce((a: number, v) => a + (v ?? 0), 0), 0),
    0
  );
}

export interface FieldValueFrames {
  value: string;
  total: number;
  frames: DataFrame[];
}

/**
 * Builds the LogsQL query that narrows the lookup endpoints (field_names, field_values,
 * stream_field_names) to the drawer's selection. The editor's own expression stays out of it
 * on purpose, because the drilldown works as if expr were `*`. `excludeKey` drops the filters
 * on one key, so a value lookup for that key still offers alternatives to the selected value
 */
export function buildLookupQuery(
  datasource: VictoriaLogsDatasource,
  filters: AdHocFilter[],
  patternFilters: PatternFilter[],
  excludeKey?: string
): string {
  const applicable = excludeKey ? filters.filter((f) => f.key !== excludeKey) : filters;
  const serialized = serializeChipsForBackend(applicable, datasource.getActiveLevelRules());
  const base = datasource.interpolateString(serialized ?? '').trim() || '*';
  return applyPatternFilters(base, patternFilters);
}

/** Builds a DataQueryRequest for the drilldown queries, which run outside the panel query flow */
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

export function buildPatternsListQuery(query: Query): Query {
  return {
    ...query,
    // sampling makes the list about five times faster on large installations. The hits it
    // returns are roughly 1/PATTERNS_SAMPLE_FACTOR of the real counts, so the table shows
    // them as "~N". The exact count shows up once the user filters for the pattern
    expr: `${query.expr} | sample ${PATTERNS_SAMPLE_FACTOR} | collapse_nums prettify | top ${PATTERNS_LIMIT + 1} by (_msg)`,
    queryType: QueryType.Instant,
    maxLines: PATTERNS_LIMIT + 1,
    hide: false,
    refId: 'drilldown-patterns-list',
  };
}

/**
 * Builds the field-values list query, which reads exact counts through `top by (field)`. Do
 * not switch it to the indexed field_values endpoint: when a field has more unique values
 * than the limit, that endpoint returns an arbitrary subset with zeroed hits
 */
export function buildFieldValuesListQuery(query: Query, field: string): Query {
  return {
    ...query,
    expr: `${query.expr} | top ${FIELD_VALUES_LIMIT + 1} by (${normalizeKey(field)})`,
    queryType: QueryType.Instant,
    maxLines: FIELD_VALUES_LIMIT + 1,
    hide: false,
    refId: `drilldown-values-list-${field}`,
  };
}

/**
 * Appends the level-derivation pipes to a volume expression, the way the main logs-volume
 * path does. They go before the first sort-class pipe, so that hits keeps the derived field
 * and the pipes still see the fields that earlier pattern pipes created
 */
export const withLevelPipes = (expr: string, grouping: LevelGrouping): string =>
  grouping.pipes ? insertPipesBeforeSortClassPipe(expr, grouping.pipes) : expr;

/** Inserts a `field:*` presence filter into the filter part of the expression, keeping the pipes */
function addFieldPresenceToExpr(expr: string, field: string): string {
  const [filters, ...pipes] = splitExpression(expr);
  const presence = `${normalizeKey(field)}:*`;
  const pipesPart = pipes?.length ? `| ${pipes.join(' | ')}` : '';
  return filters.length ? `${filters} AND ${presence} ${pipesPart}`.trim() : `${presence} ${pipesPart}`.trim();
}

/** Volume query behind a stream-fields row: hits for the logs that carry the field, split by level so the sparkline can stack them */
export function buildFieldPresenceVolumeQuery(
  query: Query,
  field: string,
  grouping: LevelGrouping,
  range: TimeRange,
  refIdSuffix: number
): Query {
  return {
    ...query,
    expr: withLevelPipes(addFieldPresenceToExpr(query.expr, field), grouping),
    queryType: QueryType.Hits,
    fields: grouping.fields,
    fieldsLimit: FIELD_HITS_LIMIT,
    step: `${calculateVolumeStep(range, DRILLDOWN_ROW_BARS)}s`,
    hide: false,
    // the suffix keeps the refIds distinct, because Grafana cancels parallel requests that
    // share one
    refId: `drilldown-field-presence-volume-${refIdSuffix}`,
  };
}

export function buildFieldPresenceLogsQuery(query: Query, field: string, refIdSuffix: number): Query {
  return {
    ...query,
    // addSortPipeToQuery in datasource.query() skips drilldown requests, so the sort belongs
    // here. Without it the backend applies `limit` to unordered rows and returns arbitrary ones
    expr: `${addFieldPresenceToExpr(query.expr, field)} | sort by (_time) desc`,
    queryType: QueryType.Instant,
    maxLines: VALUE_LOGS_SAMPLE_LIMIT,
    hide: false,
    refId: `drilldown-field-logs-${refIdSuffix}`,
  };
}

/** Volume query behind a field-values row: hits for `field = value`, split by level so the sparkline can stack them */
export function buildValueVolumeQuery(
  query: Query,
  field: string,
  value: string,
  grouping: LevelGrouping,
  range: TimeRange,
  refIdSuffix: number
): Query {
  return {
    ...query,
    expr: withLevelPipes(addLabelToQuery(query.expr, { key: field, value, operator: '=' }), grouping),
    queryType: QueryType.Hits,
    fields: grouping.fields,
    fieldsLimit: FIELD_HITS_LIMIT,
    step: `${calculateVolumeStep(range, DRILLDOWN_ROW_BARS)}s`,
    hide: false,
    // the suffix keeps the refIds distinct, because Grafana cancels parallel requests that
    // share one
    refId: `drilldown-value-volume-${refIdSuffix}`,
  };
}

/** Volume query behind a pattern row: one hits series whose sum is the pattern's exact count */
export function buildPatternVolumeQuery(query: Query, pattern: string, range: TimeRange, refIdSuffix: number): Query {
  const escapedPattern = escapeLabelValueInSelector(pattern);
  return {
    ...query,
    expr: `${query.expr} | filter pattern_match_full("${escapedPattern}")`,
    queryType: QueryType.Hits,
    fields: [],
    step: `${calculateVolumeStep(range, DRILLDOWN_ROW_BARS)}s`,
    hide: false,
    // the suffix keeps the refIds distinct, because Grafana cancels parallel requests that
    // share one
    refId: `drilldown-pattern-volume-${refIdSuffix}`,
  };
}

/** Sample-logs query for one collapsed pattern. pattern_match_full matches the collapsed shape in place, so nothing has to restore the original _msg */
export function buildPatternLogsQuery(query: Query, pattern: string, refIdSuffix: number): Query {
  const escapedPattern = escapeLabelValueInSelector(pattern);
  return {
    ...query,
    // a filter pipe rather than a plain filter, because query.expr may already contain pipes
    expr: `${query.expr} | filter pattern_match_full("${escapedPattern}") | sort by (_time) desc`,
    queryType: QueryType.Instant,
    maxLines: VALUE_LOGS_SAMPLE_LIMIT,
    hide: false,
    refId: `drilldown-pattern-logs-${refIdSuffix}`,
  };
}

/** Raw-logs query for the Logs tab. The query's own adHocFilters already narrow it to the selection */
export function buildRawLogsQuery(query: Query): Query {
  return {
    ...query,
    // addSortPipeToQuery in datasource.query() skips drilldown requests, so the sort belongs
    // here. Without it the backend applies `limit` to unordered rows and returns arbitrary ones
    expr: `${query.expr} | sort by (_time) desc`,
    queryType: QueryType.Instant,
    maxLines: LOGS_TAB_SAMPLE_LIMIT,
    hide: false,
    refId: 'drilldown-raw-logs',
  };
}

export function buildValueLogsQuery(query: Query, field: string, value: string, refIdSuffix: number): Query {
  return {
    ...query,
    // addSortPipeToQuery in datasource.query() skips drilldown requests, so the sort belongs
    // here. Without it the backend applies `limit` to unordered rows and returns arbitrary ones
    expr: `${addLabelToQuery(query.expr, { key: field, value, operator: '=' })} | sort by (_time) desc`,
    queryType: QueryType.Instant,
    maxLines: VALUE_LOGS_SAMPLE_LIMIT,
    hide: false,
    refId: `drilldown-logs-${refIdSuffix}`,
  };
}

/** Groups hits frames by the field's value, sorted by total hits descending. Without a `limit` it keeps every value, since pagination bounds what the table renders */
export function groupHitsByFieldValue(
  frames: DataFrame[],
  field: string,
  limit = Number.POSITIVE_INFINITY
): { top: FieldValueFrames[]; totalValues: number; serverTruncated: boolean } {
  const groups = new Map<string, FieldValueFrames>();
  // `fields_limit` bounds the number of unique (field, level, ...) tuples, not the number of
  // field values. VictoriaLogs merges the hits that do not fit into one remainder series that
  // carries no labels. Those hits are real but belong to no single value, so the grouping
  // drops that series and reports `serverTruncated` for the "N of M+" note upstream
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
