import { MINUTE_MS } from './constants';
import { formatSignedDuration } from './duration';

/**
 * Converts a UTC offset in minutes to a Go-style duration string for the VictoriaLogs `offset`
 * param; undefined for a zero offset. Positive minutes = east of UTC (e.g. 120 → "2h"),
 * negative = west (e.g. -330 → "-5h30m"). Callers pass the offset of the request range start,
 * which Grafana resolves for the request timezone (the browser one included) with DST applied.
 */
export function formatOffsetDuration(offsetMinutes: number): string | undefined {
  if (offsetMinutes === 0) {
    return undefined;
  }

  return formatSignedDuration(offsetMinutes * MINUTE_MS);
}
