import { getTimeZoneInfo, TimeRange, TimeZone } from '@grafana/data';

import { MINUTE_MS } from './constants';
import { formatSignedDuration } from './duration';

/**
 * UTC offset in minutes of the request timezone at the range start, DST applied. Resolved from the
 * timezone name rather than taken from the range `DateTime`: Grafana attaches the offset only to a
 * relative range (`now-6h`), while an absolute range from the URL is parsed as UTC and reports 0.
 * Falls back to the range offset for a timezone Grafana does not know. Positive minutes = east of
 * UTC, as `DateTime.utcOffset()` reports it; Grafana's `offsetInMins` counts west of UTC like
 * `Date.getTimezoneOffset()`, hence the negation
 */
export function getRangeStartOffsetMinutes(timezone: TimeZone, range: TimeRange): number {
  const info = getTimeZoneInfo(timezone, range.from.valueOf());
  // `|| 0` turns the -0 of a zero offset into 0
  return info ? -info.offsetInMins || 0 : range.from.utcOffset();
}

/**
 * Converts a UTC offset in minutes to a Go-style duration string for the VictoriaLogs `offset`
 * param; undefined for a zero offset. Positive minutes = east of UTC (e.g. 120 → "2h"),
 * negative = west (e.g. -330 → "-5h30m")
 */
export function formatOffsetDuration(offsetMinutes: number): string | undefined {
  if (offsetMinutes === 0) {
    return undefined;
  }

  return formatSignedDuration(offsetMinutes * MINUTE_MS);
}
