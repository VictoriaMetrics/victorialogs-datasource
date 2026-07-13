/**
 * Candidates for the default breakdown field, in priority order: the OTel semantic-convention
 * service attribute first, then the common non-OTel spellings
 */
const SERVICE_FIELD_CANDIDATES = ['service.name', 'service_name', 'service', 'app'];

/** Key of the "Stream fields" tab, which lists the stream fields and then their values */
export const STREAM_FIELD = '_stream';

/** Labels for the seeded tabs. Every other tab shows its raw field name */
const TAB_LABELS: Record<string, string> = {
  [STREAM_FIELD]: 'Stream fields',
  'service.name': 'Services',
};

/** Display label of a tab: the raw field name unless TAB_LABELS overrides it */
export function breakdownTabLabel(field: string): string {
  return TAB_LABELS[field] ?? field;
}

/**
 * Picks the default breakdown field: the first service-name candidate present in the data,
 * otherwise the first stream field, otherwise the first field that is not internal
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
