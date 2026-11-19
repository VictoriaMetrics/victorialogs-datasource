import { AdHocVariableFilter, CoreApp, LogsSortOrder } from '@grafana/data';

import { splitByPipes } from './LogsQL/splitByPipes';
import { isExprHasStatsPipeFunc, statsPipeFunctions } from './LogsQL/statsPipeFunctions';
import { escapeLabelValueInExactSelector } from './languageUtils';
import { getExploreSortOrder } from './store/exploreSortOrder';
import { FilterVisualQuery, Format, Query, QueryDirection, QueryType } from './types';
import {
  buildVisualQueryFromString,
  splitExpression
} from './utils/query/parseFromString';
import { parseVisualQueryToString } from './utils/query/parseToString';

const operators = ['=', '!=', '=~', '!~', '<', '>'];
const multiValueOperators = ['=|', '!=|'];
const streamKeys = ['_stream', '_stream_id'];

export function queryHasFilter(query: string, key: string, value: string, operator?: string): boolean {
  const applicableOperators = operator ? [operator] : operators;
  return applicableOperators.some(op => query.includes(getFilterInsertValue(key, value, op)));
}

const KEY_CHARS_TO_NORMALIZE = ':';
export const normalizeKey = (key: string): string => key.includes(KEY_CHARS_TO_NORMALIZE) && !key.match(/^".*"$/) ? `"${key}"` : key;

const getFilterInsertValue = (key: string, value: string, operator: string): string => {
  if (streamKeys.includes(key)) {
    return getFilterInsertValueForStream(key, value, operator);
  }

  // Filter values are stored raw and escaped only here, at serialization.
  const escaped = escapeLabelValueInExactSelector(value);
  const normalizedKey = normalizeKey(key);
  switch (operator) {
    case '=~':
      return `${normalizedKey}:~"${escaped}"`;
    default:
      return `${normalizedKey}:${operator}"${escaped}"`;
  }
};

const getFilterInsertValueForStream = (key: string, value: string, operator: string): string => {
  const normalizedKey = normalizeKey(key);
  if (operator.includes('!')) {
    return `(! ${normalizedKey}: ${value})`;
  }

  return `${normalizedKey}:${value}`;
};

const getMultiValueInsert = (key: string, values: string[], operator: string): string => {
  const isExclude = operator === '!=|';

  if (key === '_stream') {
    const expr = values.map(v => `${key}: ${v}`).join(' OR ');
    return isExclude ? `!${expr}` : `(${expr})`;
  }

  const normalizedKey = normalizeKey(key);
  const valuesStr = values.map(v => `"${escapeLabelValueInExactSelector(v)}"`).join(',');
  const expr = `${normalizedKey}:in(${valuesStr})`;
  return isExclude ? `!${expr}` : expr;
};

export const addLabelToQuery = (query: string, filter: AdHocVariableFilter): string => {
  const { key, value, values = [], operator } = filter;
  const [filters, ...pipes] = splitExpression(query);

  const isMultiValue = multiValueOperators.includes(operator);
  const insertPart = isMultiValue
    ? getMultiValueInsert(key, values, operator)
    : getFilterInsertValue(key, value, operator);

  const pipesPart = pipes?.length ? `| ${pipes.join(' | ')}` : '';
  return filters.length ? (`${filters} AND ${insertPart} ${pipesPart}`).trim() : (`${insertPart} ${pipesPart}`).trim();
};

export const removeLabelFromQuery = (query: string, key: string, value: string, operator?: string): string => {
  const { query: { filters, pipes }, errors } = buildVisualQueryFromString(query);

  if (errors.length) {
    console.error(errors.join('\n'));
    return query;
  }

  const keyValues = operator
    ? [getFilterInsertValue(key, value, operator)]
    : operators.map(op => getFilterInsertValue(key, value, op));

  keyValues.forEach(keyValue => recursiveRemove(filters, keyValue));

  return parseVisualQueryToString({ filters, pipes });
};

const recursiveRemove = (filters: FilterVisualQuery, keyValue: string): boolean => {
  const { values, operators } = filters;
  let removed = false;

  for (let i = values.length - 1; i >= 0; i--) {
    const val = values[i];
    const isString = typeof val === 'string';
    const isFilterObject = typeof val === 'object' && 'values' in val;

    if (isString && val === keyValue) {
      // If the string matches keyValue, delete it and the operator
      values.splice(i, 1);
      (i > 0 && i - 1 < operators.length) && operators.splice(i - 1, 1);
      removed = true;
    } else if (isFilterObject) {
      // If it is an object of type FilterVisualQuery, recursively check it
      const wasRemoved = recursiveRemove(val, keyValue);
      removed = wasRemoved || removed;
    }
  }

  return removed;
};

/** The logs sort order of the Explore pane that issued the request */
const getExploreSortDirection =(requestId?: string): QueryDirection =>
  getExploreSortOrder(requestId) === LogsSortOrder.Ascending ? 'asc' : 'desc';

/**
 * The `sort_direction` of a Raw Logs request: the logs sort order of the requesting pane in
 * Explore, the direction option in dashboards. None for other apps, other query types and live streams.
 * VictoriaLogs ignores the arg itself when the query sorts, limits or aggregates its rows.
 */
export const getSortDirection = (
  { queryType, direction }: Query,
  app: CoreApp | string,
  isLiveStreaming = false,
  requestId?: string
): QueryDirection | undefined => {
  if (queryType !== QueryType.Instant || isLiveStreaming) {
    return undefined;
  }
  switch (app) {
    case CoreApp.Dashboard:
    case CoreApp.PanelEditor:
    // the View mode of a panel in the dashboards of Grafana before the scenes
    case CoreApp.PanelViewer:
      return direction ?? 'desc';
    case CoreApp.Explore:
      return getExploreSortDirection(requestId);
    default:
      return undefined;
  }
};

// Matches a pipe segment that reorders or slices rows: `sort`/`order by`,
// `limit`/`head`, `offset`/`skip` and the `first`/`last` sort+limit shorthands
const SORT_CLASS_PIPE_RE = /^(?:sort|order|limit|head|offset|skip|first|last)\b/i;

/**
 * Inserts a pipe suffix (starting with ` | `) before the first sort-class pipe,
 * or appends it at the end when the expression has none. `|` characters inside
 * quoted values, parentheses or `{}` are ignored when locating pipes.
 * VictoriaLogs `/select/logsql/hits` ignores sort-class pipes and returns empty
 * values for fields created by pipes placed after them, so the logs volume
 * format pipes must land after the field-transforming pipes (whose fields the
 * level rules may reference) but before the first sort-class pipe.
 */
export const insertPipesBeforeSortClassPipe = (expr: string, pipesSuffix: string): string => {
  const segments = splitByPipes(expr);
  // segments[0] is the filter part, so only later segments are pipes
  const sortClassIdx = segments.findIndex((segment, i) => i > 0 && SORT_CLASS_PIPE_RE.test(segment));
  if (sortClassIdx === -1) {
    return `${expr}${pipesSuffix}`;
  }
  const head = segments.slice(0, sortClassIdx).join(' | ');
  const tail = segments.slice(sortClassIdx).join(' | ');
  return `${head}${pipesSuffix} | ${tail}`;
};


// Matches a pipe segment that replaces log rows with something else (aggregated
// rows, field/stream listings, block and query statistics, generated rows), so
// the pipes from it onwards cannot produce raw log lines. The `stats` keyword is
// optional in LogsQL, so `by (...)` and bare stats function calls match too
const AGGREGATION_PIPES = [
  'stats',
  'top',
  'uniq',
  'facets',
  'field_names',
  'field_values',
  'block_stats',
  'blocks_count',
  'query_stats',
  'generate_sequence',
];
const AGGREGATION_PIPE_RE = new RegExp(
  `^(?:(?:${AGGREGATION_PIPES.join('|')})\\b|by\\s*\\(|(?:${statsPipeFunctions.join('|')})\\s*\\()`,
  'i'
);

/**
 * Cuts the expression at its first aggregation pipe (`stats`, `top`, `uniq`...),
 * so a metric query can be turned into the raw logs query behind it. Returns
 * the expression unchanged when it has no aggregation pipe. `|` characters
 * inside quoted values, parentheses or `{}` are ignored when locating pipes.
 */
export const removeAggregationPipes = (expr: string): string => {
  const segments = splitByPipes(expr);
  // segments[0] is the filter part, so only later segments are pipes
  const aggregationIdx = segments.findIndex((segment, i) => i > 0 && AGGREGATION_PIPE_RE.test(segment));
  if (aggregationIdx === -1) {
    return expr;
  }
  return segments.slice(0, aggregationIdx).join(' | ');
};

// Matches a pipe segment whose output for a row depends on the other rows of the query
const CROSS_ROW_PIPE_RE = /^(?:join|union|stream_context|running_stats|total_stats|sample)\b/i;

// Matches a pipe segment that may rewrite `_time`, so a row leaves the time range it was found in.
// The `as` keyword is optional in LogsQL, so any mention of `_time` in a pipe that writes fields counts
const TIME_REWRITE_PIPE_RE =
  /^(?:time_add\b|(?:copy|cp|rename|mv|format|math|eval|(?:replace|extract)(?:_regexp)?|unpack_(?:json|logfmt|syslog))\b.*\b_time\b)/i;

const NOT_SPLITTABLE_PIPES = [SORT_CLASS_PIPE_RE, AGGREGATION_PIPE_RE, CROSS_ROW_PIPE_RE, TIME_REWRITE_PIPE_RE];

/**
 * Whether the logs of a time range are the logs of its parts put together, so the
 * range can be loaded part by part. `|` characters inside quoted values, parentheses
 * or `{}` are ignored when locating pipes.
 */
export const isSplittableByTime = (expr: string): boolean =>
  splitByPipes(expr)
    .slice(1)
    .every((pipe) => !NOT_SPLITTABLE_PIPES.some((re) => re.test(pipe)));


export const getQueryFormat = (expr: string): Format | undefined => {
  if (isExprHasStatsPipeFunc(expr, 'histogram')) {
    return 'histogram' as const;
  }

  return undefined;
};
