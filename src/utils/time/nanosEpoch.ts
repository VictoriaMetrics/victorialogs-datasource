/**
 * Formats a unix nanosecond-epoch string (e.g. LogRowModel.timeEpochNs) as an RFC3339
 * timestamp with a 9-digit fraction: "2023-11-14T22:13:20.000123456Z".
 * The value exceeds Number.MAX_SAFE_INTEGER, so it is split as a string
 * into seconds and the nanosecond remainder instead of doing number arithmetic
 */
export function formatNanosEpochToISO(timeEpochNs: string): string {
  // at least 10 chars so there is always a seconds part and a full 9-digit fraction
  const digits = timeEpochNs.padStart(10, '0');
  const seconds = Number(digits.slice(0, -9));
  const fraction = digits.slice(-9);
  return new Date(seconds * 1000).toISOString().replace('.000Z', `.${fraction}Z`);
}
