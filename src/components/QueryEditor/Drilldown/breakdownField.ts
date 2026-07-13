/**
 * Default breakdown-field candidates in priority order: OTel semantic-convention
 * service attribute first, then common non-OTel spellings. Same pattern as
 * TRACE_FIELD_CANDIDATES in the OpenTelemetry preset
 */
export const SERVICE_FIELD_CANDIDATES = ['service.name', 'service_name', 'service', 'app'];

/** Field of the always-offered "streams" breakdown tab — one row per unique `{...}` stream selector */
export const STREAM_FIELD = '_stream';

/** Human-friendly labels for the seeded main-view tabs; other tabs show their raw field name */
const TAB_LABELS: Record<string, string> = {
  [STREAM_FIELD]: 'Streams',
  'service.name': 'Services',
};

/** Display label of a main-view breakdown tab — the raw field name unless overridden */
export function breakdownTabLabel(field: string): string {
  return TAB_LABELS[field] ?? field;
}

/**
 * Picks the default breakdown field for the drilldown main view: the first
 * service-name candidate present in the data, else the first stream field
 * (most stream-defining label), else the first non-internal field
 */
export function detectBreakdownField(fieldNames: string[], streamFieldNames: string[]): string | undefined {
  const available = new Set(fieldNames);
  for (const candidate of SERVICE_FIELD_CANDIDATES) {
    if (available.has(candidate)) {
      return candidate;
    }
  }
  const streamField = streamFieldNames.find((f) => available.has(f)) ?? streamFieldNames[0];
  if (streamField) {
    return streamField;
  }
  return fieldNames.find((f) => !f.startsWith('_'));
}
