import { StreamFilterState } from '../../../../../types';

/**
 * Escapes double quotes in a stream filter value.
 */
function escapeStreamValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Formats a single stream filter value for use in a LogsQL stream filter.
 * Template variables (starting with $) are passed through as-is so they can
 * be interpolated later; regular values are wrapped in double quotes.
 */
function formatStreamValue(value: string): string {
  return value.startsWith('$') ? value : `"${escapeStreamValue(value)}"`;
}

/**
 * Serializes a single StreamFilterState into a LogsQL stream filter string.
 *
 * Examples:
 *   {label: "app", operator: "=", values: ["nginx"]}           -> '_stream:{app in ("nginx")}'
 *   {label: "app", operator: "=", values: ["nginx", "apache"]}  -> '_stream:{app in ("nginx", "apache")}'
 *   {label: "app", operator: "!=", values: ["nginx"]}           -> '_stream:{app not_in ("nginx")}'
 *   {label: "app", operator: "!=", values: ["nginx", "apache"]} -> '_stream:{app not_in ("nginx", "apache")}'
 *   {label: "app", operator: "=", values: ["$myVar"]}           -> '_stream:{app in ($myVar)}'
 */
export function streamFilterToString(filter: StreamFilterState): string {
  if (!filter.label || filter.values.length === 0) {
    return '';
  }

  const op = filter.operator || '=';
  const isNeg = op === '!=';

  const valuesList = filter.values.map(formatStreamValue).join(', ');
  const inOp = isNeg ? 'not_in' : 'in';
  return `_stream:{${filter.label} ${inOp} (${valuesList})}`;
}

/**
 * Serializes an array of StreamFilterState into a single extra_stream_filters string.
 * Only includes filters that have both a label and at least one value.
 * Multiple filters are joined with AND.
 *
 * Example:
 *   [{label: "app", operator: "=", values: ["nginx"]}, {label: "host", operator: "=", values: ["h1", "h2"]}]
 *   -> '_stream:{app="nginx"} AND _stream:{host in ("h1", "h2")}'
 */
export function buildStreamExtraFilters(filters: StreamFilterState[]): string {
  const parts = filters.map(streamFilterToString).filter((s) => s !== '');

  return parts.join(' AND ');
}

/**
 * Builds extra_stream_filters string from filters preceding the given index.
 * Used to scope subsequent filter dropdowns by already selected values.
 */
export function buildPrecedingStreamFilters(filters: StreamFilterState[], currentIndex: number): string {
  const preceding = filters.slice(0, currentIndex);
  return buildStreamExtraFilters(preceding);
}

/**
 * Returns the set of label names already used by other filters (excluding the given index).
 */
export function getUsedLabelNames(filters: StreamFilterState[], excludeIndex: number): Set<string> {
  const used = new Set<string>();
  for (let i = 0; i < filters.length; i++) {
    if (i !== excludeIndex && filters[i].label) {
      used.add(filters[i].label);
    }
  }
  return used;
}
