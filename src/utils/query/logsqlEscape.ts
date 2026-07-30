/**
 * Escapes a raw value for use inside a double-quoted LogsQL string literal.
 * Backslashes, newlines and double quotes must be escaped — a Go-style
 * string literal cannot contain a raw line break, and VictoriaLogs rejects
 * the whole query on one
 */
export function escapeLogsQLQuotedValue(value: string | number): string {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

/** Wraps a raw value in double quotes, escaping it for LogsQL */
export function quoteLogsQLValue(value: string | number): string {
  return `"${escapeLogsQLQuotedValue(value)}"`;
}

/**
 * Quotes a LogsQL field name when it contains characters that would clash with
 * the query syntax (e.g. `log:level` would otherwise parse as field `log`).
 * Plain names of letters, digits, `_` and `.` are returned as-is
 */
export function quoteLogsQLFieldName(field: string): string {
  return /^[a-zA-Z0-9_.]+$/.test(field) ? field : quoteLogsQLValue(field);
}
