import { DateTime, TimeRange } from '@grafana/data';

/**
 * A relative bound (`now-1h`) compares by its expression, because re-picking the same relative
 * range resolves to slightly later timestamps. Any other bound compares by its resolved time
 */
const boundKey = (raw: DateTime | string, resolved: DateTime): string | number =>
  typeof raw === 'string' && raw.includes('now') ? raw : resolved.valueOf();

/** Whether both ranges select the same period, e.g. when the user re-picks the original range */
export function isSameTimeRange(a: TimeRange, b: TimeRange): boolean {
  return boundKey(a.raw.from, a.from) === boundKey(b.raw.from, b.from) && boundKey(a.raw.to, a.to) === boundKey(b.raw.to, b.to);
}
