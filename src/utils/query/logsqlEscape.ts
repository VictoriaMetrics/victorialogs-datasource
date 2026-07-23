/**
 * Escapes a value for interpolation into a double-quoted LogsQL string literal.
 * VictoriaLogs unquotes literals Go-style, so escaping `\` and `"` round-trips
 * the original value for every filter type, including regex.
 */
export function escapeLogsQLQuotedValue(value: string | number): string {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Wraps a value into a double-quoted LogsQL string literal with escaping
 */
export function quoteLogsQLValue(value: string | number): string {
  return `"${escapeLogsQLQuotedValue(value)}"`;
}
