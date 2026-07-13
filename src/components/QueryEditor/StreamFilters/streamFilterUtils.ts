import { StreamFilterState } from '../../../types';
import { isVariable } from '../../../utils/isVariable';
import { quoteLogsQLValue } from '../../../utils/query/logsqlEscape';
import { streamFilterOperator } from '../../../utils/query/streamFilterToggle';

/**
 * Formats a single stream filter value for use in a LogsQL stream filter.
 * Template variables (starting with $) are passed through as-is so they can
 * be interpolated later; regular values are wrapped in double quotes.
 */
function formatStreamValue(value: string): string {
  return isVariable(value) ? value : quoteLogsQLValue(value);
}

// Label names the LogsQL parser accepts without quotes; anything else
// (spaces, quotes, unicode, …) would be misparsed, e.g. `{foo bar in (...)}`
// reads `bar` as an unsupported operation
const UNQUOTED_LABEL_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * Formats a stream filter label for use in a LogsQL stream filter.
 * Template variables are passed through as-is; labels outside the safe
 * charset are wrapped in double quotes.
 */
function formatStreamLabel(label: string): string {
  if (isVariable(label) || UNQUOTED_LABEL_PATTERN.test(label)) {
    return label;
  }
  return quoteLogsQLValue(label);
}

/**
 * Serializes a single StreamFilterState into a LogsQL stream filter string.
 *
 * Examples:
 *   {label: "app", operator: "in", values: ["nginx"]}           -> '_stream:{app in ("nginx")}'
 *   {label: "app", operator: "in", values: ["nginx", "apache"]}  -> '_stream:{app in ("nginx", "apache")}'
 *   {label: "app", operator: "not_in", values: ["nginx"]}           -> '_stream:{app not_in ("nginx")}'
 *   {label: "app", operator: "not_in", values: ["nginx", "apache"]} -> '_stream:{app not_in ("nginx", "apache")}'
 *   {label: "app", operator: "in", values: ["$myVar"]}           -> '_stream:{app in ($myVar)}'
 */
export function streamFilterToString(filter: StreamFilterState): string {
  if (!filter.label || filter.values.length === 0) {
    return '';
  }

  const op = streamFilterOperator(filter);

  const valuesList = filter.values.map(formatStreamValue).join(', ');
  return `_stream:{${formatStreamLabel(filter.label)} ${op} (${valuesList})}`;
}

/**
 * Serializes an array of StreamFilterState into a single extra_stream_filters string.
 * Only includes filters that have both a label and at least one value.
 * Multiple filters are joined with AND.
 *
 * Example:
 *   [{label: "app", operator: "in", values: ["nginx"]}, {label: "host", operator: "in", values: ["h1", "h2"]}]
 *   -> '_stream:{app="nginx"} AND _stream:{host in ("h1", "h2")}'
 */
export function buildStreamExtraFilters(filters: StreamFilterState[]): string {
  const parts = filters.map(streamFilterToString).filter((s) => s !== '');

  return parts.join(' AND ');
}

/**
 * Merges a serialized stream-filter expression into lookup request params as
 * `extra_stream_filters`; returns the base params untouched when there is nothing to add
 */
export function withExtraStreamFilters(
  base: URLSearchParams | undefined,
  extra: string | undefined
): URLSearchParams | undefined {
  if (!extra) {
    return base;
  }
  const params = new URLSearchParams(base);
  params.set('extra_stream_filters', extra);
  return params;
}
