import { dateTime, TimeRange } from '@grafana/data';

import {
  bucketTimeRange,
  formatOffsetDuration,
  getDurationFromMilliseconds,
  getMillisecondsFromDuration,
} from './timeUtils';

const makeRange = (fromMs: number, toMs: number): TimeRange => {
  const from = dateTime(fromMs);
  const to = dateTime(toMs);
  return { from, to, raw: { from, to } };
};

const DAY_MS = 86_400_000;

describe('timeUtils', () => {
  describe('getDurationFromMilliseconds', () => {
    it('should return "1ms" for 1 millisecond', () => {
      expect(getDurationFromMilliseconds(1)).toBe('1ms');
    });

    it('should return "1s" for 1000 milliseconds', () => {
      expect(getDurationFromMilliseconds(1000)).toBe('1s');
    });

    it('should return "1m" for 60000 milliseconds', () => {
      expect(getDurationFromMilliseconds(60000)).toBe('1m');
    });

    it('should return "1h" for 3600000 milliseconds', () => {
      expect(getDurationFromMilliseconds(3600000)).toBe('1h');
    });

    it('should return "1d" for 86400000 milliseconds', () => {
      expect(getDurationFromMilliseconds(86400000)).toBe('1d');
    });

    it('should return "1d 2h 3m 4s 5ms" for 93784005 milliseconds', () => {
      expect(getDurationFromMilliseconds(93784005)).toBe('1d2h3m4s5ms');
    });

    it('should return "2h 30m" for 9000000 milliseconds', () => {
      expect(getDurationFromMilliseconds(9000000)).toBe('2h30m');
    });

    it('should return an empty string for 0 milliseconds', () => {
      expect(getDurationFromMilliseconds(0)).toBe('');
    });

    it('should handle large durations correctly', () => {
      expect(getDurationFromMilliseconds(1234567890)).toBe('14d6h56m7s890ms');
    });

    it('should handle durations with no milliseconds', () => {
      expect(getDurationFromMilliseconds(86400000 + 3600000)).toBe('1d1h');
    });
  });

  describe('getMillisecondsFromDuration', () => {
    it('should return 1 for "1ms"', () => {
      expect(getMillisecondsFromDuration('1ms')).toBe(1);
    });

    it('should return 1000 for "1s"', () => {
      expect(getMillisecondsFromDuration('1s')).toBe(1000);
    });

    it('should return 60000 for "1m"', () => {
      expect(getMillisecondsFromDuration('1m')).toBe(60000);
    });

    it('should return 3600000 for "1h"', () => {
      expect(getMillisecondsFromDuration('1h')).toBe(3600000);
    });

    it('should return 86400000 for "1d"', () => {
      expect(getMillisecondsFromDuration('1d')).toBe(86400000);
    });

    it('should return 93784005 for "1d 2h 3m 4s 5ms"', () => {
      expect(getMillisecondsFromDuration('1d 2h 3m 4s 5ms')).toBe(93784005);
    });

    it('should return 9000000 for "2h 30m"', () => {
      expect(getMillisecondsFromDuration('2h 30m')).toBe(9000000);
    });

    it('should return 0 for an empty string', () => {
      expect(getMillisecondsFromDuration('')).toBe(0);
    });

    it('should return 1234567890 for a complex duration string', () => {
      expect(getMillisecondsFromDuration('14d 6h 56m 7s 890ms')).toBe(1234567890);
    });

    it('should handle invalid durations gracefully by returning 0', () => {
      expect(getMillisecondsFromDuration('invalid')).toBe(0);
    });
  });

  describe('formatOffsetDuration', () => {
    it('should return empty string for 0', () => {
      expect(formatOffsetDuration('custom', 0)).toBeUndefined();
    });

    it('should format positive hours "2h"', () => {
      expect(formatOffsetDuration('custom', 120)).toBe('2h');
    });

    it('should format negative hours "-5h"', () => {
      expect(formatOffsetDuration('custom', -300)).toBe('-5h');
    });

    it('should format hours and minutes "5h30m"', () => {
      expect(formatOffsetDuration('custom', 330)).toBe('5h30m');
    });

    it('should format negative hours and minutes "-5h30m"', () => {
      expect(formatOffsetDuration('custom', -330)).toBe('-5h30m');
    });

    it('should format minutes only "30m"', () => {
      expect(formatOffsetDuration('custom', 30)).toBe('30m');
    });

    it('should format negative minutes only "-45m"', () => {
      expect(formatOffsetDuration('custom', -45)).toBe('-45m');
    });

    it('should format "5h45m" for Nepal timezone offset', () => {
      expect(formatOffsetDuration('custom', 345)).toBe('5h45m');
    });
  });

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
});
