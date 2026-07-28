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
