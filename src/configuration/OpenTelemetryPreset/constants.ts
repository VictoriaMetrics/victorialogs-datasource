import { LogLevel } from '@grafana/data';

/**
 * Canonical OTel severity text -> Grafana LogLevel mapping.
 * Keys are lowercase for case-insensitive comparison; actual rule values
 * use the detected case (upper / lower / both for mixed)
 */
export const OTEL_SEVERITY_TO_LEVEL: Record<string, LogLevel> = {
  trace: LogLevel.trace,
  debug: LogLevel.debug,
  info: LogLevel.info,
  warn: LogLevel.warning,
  error: LogLevel.error,
  fatal: LogLevel.critical,
};


/** Mapping of Grafana LogLevel -> OTel severity number */
export const OTEL_LEVEL_TO_SEVERITY_NUMBER = {
  [LogLevel.trace]: '^([1-4])$',
  [LogLevel.debug]: '^([5-8])$',
  [LogLevel.info]: '^(9|10|11|12)$',
  [LogLevel.warning]: '^(1[3-6])$',
  [LogLevel.error]: '^(1[7-9]|20)$',
  [LogLevel.critical]: '^(2[1-4])$',
} as const;

/** Canonical order used when generating rules */
export const OTEL_SEVERITY_KEYS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

/** Fallback defaults when field_names returns empty */
export const DEFAULT_TRACE_ID_FIELD_SNAKE = 'trace_id';
export const DEFAULT_TRACE_ID_FIELD_CAMEL = 'traceId';
export const DEFAULT_TRACE_ID_FIELD_PASCAL = 'TraceId';
export const DEFAULT_SEVERITY_FIELD = 'severity_number';

/**
 * TraceID field candidates in priority order per OTel spec preference
 * First match wins during auto-detection
 */
export const TRACE_FIELD_CANDIDATES = [
  DEFAULT_TRACE_ID_FIELD_SNAKE,
  DEFAULT_TRACE_ID_FIELD_CAMEL,
  DEFAULT_TRACE_ID_FIELD_PASCAL
];

/**
 * Severity field candidates in priority order per OTel spec preference
 * First match wins during auto-detection
 */
export const SEVERITY_FIELD_CANDIDATES = [
  'severity_number',
  'severityNumber',
  'SeverityNumber',
  'severity_text',
  'SeverityText',
  'severity',
  'Severity',
];

/** Detection window in ms. Spec: last 24 hours */
export const DETECTION_TIME_WINDOW_MS = 24 * 60 * 60 * 1000;

/** How many field_names we request for detection */
export const FIELD_NAMES_SAMPLE_LIMIT = 5000;
