import { dateTime, TimeRange } from '@grafana/data';

import { bucketTimeRange } from './bucketTimeRange';
import { DAY_MS } from './constants';

const makeRange = (fromMs: number, toMs: number): TimeRange => {
  const from = dateTime(fromMs);
  const to = dateTime(toMs);
  return { from, to, raw: { from, to } };
};

describe('bucketTimeRange', () => {
  it('snaps a 1-hour span to the surrounding UTC day', () => {
    const from = Date.UTC(2026, 4, 8, 12, 0, 0);
    const to = Date.UTC(2026, 4, 8, 13, 0, 0);
    const result = bucketTimeRange(makeRange(from, to));
    expect(result.from.valueOf()).toBe(Date.UTC(2026, 4, 8));
    expect(result.to.valueOf()).toBe(Date.UTC(2026, 4, 9) - 1);
  });

  it('produces the same bucket for 1h, 6h, and 23h ranges within the same UTC day', () => {
    const day = Date.UTC(2026, 4, 8);
    const ranges = [
      bucketTimeRange(makeRange(day + 12 * 3600_000, day + 13 * 3600_000)),
      bucketTimeRange(makeRange(day + 8 * 3600_000, day + 14 * 3600_000)),
      bucketTimeRange(makeRange(day, day + 23 * 3600_000)),
    ];
    for (const r of ranges) {
      expect(r.from.valueOf()).toBe(day);
      expect(r.to.valueOf()).toBe(day + DAY_MS - 1);
    }
  });

  it('uses the correct day bucket for ranges shifted into the past', () => {
    // "Yesterday" 14:00 → 15:00 UTC: bucket must be that previous day, not today.
    const from = Date.UTC(2026, 4, 7, 14, 0, 0);
    const to = Date.UTC(2026, 4, 7, 15, 0, 0);
    const result = bucketTimeRange(makeRange(from, to));
    expect(result.from.valueOf()).toBe(Date.UTC(2026, 4, 7));
    expect(result.to.valueOf()).toBe(Date.UTC(2026, 4, 8) - 1);
  });

  it('snaps a 25-hour span to the surrounding ISO week (Mon..Sun, UTC)', () => {
    // Wed 2026-05-06 12:00 UTC → Thu 2026-05-07 13:00 UTC (25h)
    const from = Date.UTC(2026, 4, 6, 12, 0, 0);
    const to = Date.UTC(2026, 4, 7, 13, 0, 0);
    const result = bucketTimeRange(makeRange(from, to));
    // Monday of that week is 2026-05-04
    expect(result.from.valueOf()).toBe(Date.UTC(2026, 4, 4));
    expect(result.to.valueOf()).toBe(Date.UTC(2026, 4, 11) - 1);
  });

  it('snaps a 10-day span to the surrounding calendar month', () => {
    const from = Date.UTC(2026, 4, 5, 0, 0, 0);
    const to = Date.UTC(2026, 4, 14, 23, 0, 0);
    const result = bucketTimeRange(makeRange(from, to));
    expect(result.from.valueOf()).toBe(Date.UTC(2026, 4, 1));
    expect(result.to.valueOf()).toBe(Date.UTC(2026, 5, 1) - 1);
  });

  it('snaps a 60-day span to the surrounding calendar year', () => {
    const from = Date.UTC(2026, 2, 1, 0, 0, 0);
    const to = Date.UTC(2026, 3, 30, 0, 0, 0);
    const result = bucketTimeRange(makeRange(from, to));
    expect(result.from.valueOf()).toBe(Date.UTC(2026, 0, 1));
    expect(result.to.valueOf()).toBe(Date.UTC(2027, 0, 1) - 1);
  });

  it('treats exactly 24h as day-bucket and 24h + 1ms as week-bucket', () => {
    const dayStart = Date.UTC(2026, 4, 7, 12, 0, 0);
    // Exactly 24h still triggers day-bucket; from/to snap to two consecutive day boundaries.
    const dayCase = bucketTimeRange(makeRange(dayStart, dayStart + DAY_MS));
    expect(dayCase.from.valueOf()).toBe(Date.UTC(2026, 4, 7));
    expect(dayCase.to.valueOf()).toBe(Date.UTC(2026, 4, 9) - 1);

    // One millisecond more crosses into the week bucket.
    const weekCase = bucketTimeRange(makeRange(dayStart, dayStart + DAY_MS + 1));
    expect(weekCase.from.valueOf()).toBe(Date.UTC(2026, 4, 4));
    expect(weekCase.to.valueOf()).toBe(Date.UTC(2026, 4, 11) - 1);
  });

  it('treats exactly 7d as week-bucket and 7d + 1ms as month-bucket', () => {
    const weekStart = Date.UTC(2026, 4, 4, 0, 0, 0);
    const weekCase = bucketTimeRange(makeRange(weekStart, weekStart + 7 * DAY_MS));
    expect(weekCase.from.valueOf()).toBe(Date.UTC(2026, 4, 4));
    // `to` snaps up to the end of its own week (the next Mon..Sun starting 2026-05-11)
    expect(weekCase.to.valueOf()).toBe(Date.UTC(2026, 4, 18) - 1);

    const monthCase = bucketTimeRange(makeRange(weekStart, weekStart + 7 * DAY_MS + 1));
    expect(monthCase.from.valueOf()).toBe(Date.UTC(2026, 4, 1));
    expect(monthCase.to.valueOf()).toBe(Date.UTC(2026, 5, 1) - 1);
  });
});
