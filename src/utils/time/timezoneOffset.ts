import { MINUTE_MS } from './constants';
import { formatSignedDuration } from './duration';

/**
 * Resolves the UTC offset in minutes for the request timezone: the range offset for an
 * explicit timezone, the current browser offset for the `browser` one
 */
export function getTimezoneOffsetMinutes(timezone: string, rangeOffsetMinutes: number): number {
  if (timezone === 'browser') {
    // browser timezone offset in minutes with the opposite sign (e.g. UTC+2 is -120, so we multiply by -1 to get 120)
    return new Date().getTimezoneOffset() * -1;
  }
  return rangeOffsetMinutes;
}

/**
 * Converts total minutes offset to a Go-style duration string for VictoriaLogs offset param.
 * Positive minutes = east of UTC (e.g. 120 → "2h"), negative = west (e.g. -330 → "-5h30m").
 */
export function formatOffsetDuration(timezone: string, totalMinutes: number): string | undefined {
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, totalMinutes);
  if (offsetMinutes === 0) {
    return undefined;
  }

  return formatSignedDuration(offsetMinutes * MINUTE_MS);
}
