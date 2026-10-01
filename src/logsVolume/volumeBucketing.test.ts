import { DataQueryRequest, dateTime, dateTimeForTimeZone, makeTimeRange, TimeRange } from '@grafana/data';

import { Query } from '../types';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../utils/time/constants';

import { getRequestVolumeBucketing, getVolumeBucketing } from './volumeBucketing';

const makeRange = (fromMs: number, toMs: number): TimeRange => makeTimeRange(dateTime(fromMs), dateTime(toMs));

// 2026-09-21T10:20:00Z (Monday)
const T0 = Date.UTC(2026, 8, 21, 10, 20);

describe('getVolumeBucketing', () => {
  describe('step selection (the VMUI step closest to range / target bars on the log scale)', () => {
    it.each([
      ['5m', 5 * MINUTE_MS, '5s'],
      ['15m', 15 * MINUTE_MS, '10s'],
      ['30m', 30 * MINUTE_MS, '15s'],
      ['1h', HOUR_MS, '30s'],
      ['6h', 6 * HOUR_MS, '5m'],
      ['24h', DAY_MS, '15m'],
      ['7d', 7 * DAY_MS, '3h'],
      ['30d', 30 * DAY_MS, '6h'],
      ['90d', 90 * DAY_MS, '1d'],
      ['1y', 365 * DAY_MS, '7d'],
    ])('%s with the default 96 bars → step %s', (_label, span, step) => {
      expect(getVolumeBucketing(makeRange(T0 - span, T0), 0).step).toBe(step);
    });

    it('picks a coarser step for fewer target bars', () => {
      expect(getVolumeBucketing(makeRange(T0 - HOUR_MS, T0), 0, 24).step).toBe('5m');
      expect(getVolumeBucketing(makeRange(T0 - DAY_MS, T0), 0, 24).step).toBe('1h');
      expect(getVolumeBucketing(makeRange(T0 - 30 * DAY_MS, T0), 0, 24).step).toBe('1d');
    });

    it('clamps to the smallest and the largest step', () => {
      expect(getVolumeBucketing(makeRange(T0 - 10_000, T0), 0).step).toBe('1s');
      expect(getVolumeBucketing(makeRange(T0 - 200 * 365 * DAY_MS, T0), 0).step).toBe('364d');
    });
  });

  describe('bucketStarts (the volume time axis)', () => {
    it('lists the grid starts of every bucket the range touches in ascending order', () => {
      // 3h at 36 target bars → 5m step; range starts at 10:20 and ends at 13:20 — both on the grid
      const { bucketStarts } = getVolumeBucketing(makeRange(T0, T0 + 3 * HOUR_MS), 0, 36);
      expect(bucketStarts).toHaveLength(36);
      expect(bucketStarts[0]).toBe(T0);
      expect(bucketStarts[35]).toBe(T0 + 3 * HOUR_MS - 5 * MINUTE_MS);
    });

    it('starts the first bucket on the grid before the range and stops before the range end', () => {
      // 10:22 → 13:17, 5m grid: the oldest bucket starts at 10:20, the newest at 13:15
      const from = T0 + 2 * MINUTE_MS;
      const to = T0 + 3 * HOUR_MS - 3 * MINUTE_MS;
      const { bucketStarts } = getVolumeBucketing(makeRange(from, to), 0, 36);
      expect(bucketStarts[0]).toBe(T0);
      expect(bucketStarts[bucketStarts.length - 1]).toBe(to - 2 * MINUTE_MS);
      expect(bucketStarts).toHaveLength(36);
    });

    it('does not add an empty bucket when the range ends exactly on the grid', () => {
      const { bucketStarts } = getVolumeBucketing(makeRange(T0, T0 + 10 * MINUTE_MS), 0, 2);
      expect(bucketStarts).toEqual([T0, T0 + 5 * MINUTE_MS]);
    });

    it('aligns day buckets to local midnight of the given timezone offset', () => {
      // 30d at 30 target bars → 1d step, UTC+2: local midnight is 22:00Z of the previous day
      const to = Date.UTC(2026, 8, 21, 10, 0);
      const { bucketStarts } = getVolumeBucketing(makeRange(to - 30 * DAY_MS, to), 120, 30);
      expect(bucketStarts[bucketStarts.length - 1]).toBe(Date.UTC(2026, 8, 20, 22, 0));
      expect(bucketStarts[bucketStarts.length - 2]).toBe(Date.UTC(2026, 8, 19, 22, 0));
    });

    it('aligns week buckets to Monday 00:00 local time', () => {
      // 2026-09-21 is a Monday; 365d → 7d step, UTC+2 → Sunday 22:00Z
      const to = Date.UTC(2026, 8, 21, 10, 0);
      const { bucketStarts } = getVolumeBucketing(makeRange(to - 365 * DAY_MS, to), 120, 52);
      expect(bucketStarts[bucketStarts.length - 1]).toBe(Date.UTC(2026, 8, 20, 22, 0));
      expect(bucketStarts[bucketStarts.length - 2]).toBe(Date.UTC(2026, 8, 13, 22, 0));
    });
  });

  describe('offset (VictoriaLogs bucket grid shift)', () => {
    it('is undefined for a zero timezone offset and a sub-week step', () => {
      expect(getVolumeBucketing(makeRange(T0 - DAY_MS, T0), 0).offset).toBeUndefined();
    });

    it('equals the timezone offset for sub-week steps', () => {
      expect(getVolumeBucketing(makeRange(T0 - DAY_MS, T0), 120).offset).toBe('2h');
      expect(getVolumeBucketing(makeRange(T0 - DAY_MS, T0), -330).offset).toBe('-5h30m');
    });

    it('adds three days for the week step so weeks start on Monday instead of the epoch Thursday', () => {
      expect(getVolumeBucketing(makeRange(T0 - 365 * DAY_MS, T0), 0).offset).toBe('3d');
      expect(getVolumeBucketing(makeRange(T0 - 365 * DAY_MS, T0), 120).offset).toBe('3d2h');
      expect(getVolumeBucketing(makeRange(T0 - 365 * DAY_MS, T0), -120).offset).toBe('2d22h');
    });

    it('adds the three days for every whole-week step', () => {
      // 365d / 26 bars ≈ 14d, 365d / 13 bars ≈ 28d
      expect(getVolumeBucketing(makeRange(T0 - 365 * DAY_MS, T0), 0, 26)).toMatchObject({ step: '14d', offset: '3d' });
      expect(getVolumeBucketing(makeRange(T0 - 365 * DAY_MS, T0), 120, 13)).toMatchObject({
        step: '28d',
        offset: '3d2h',
      });
    });
  });
});

describe('getRequestVolumeBucketing', () => {
  const request = (timezone: string, range: TimeRange, maxDataPoints?: number) =>
    ({ timezone, range, maxDataPoints }) as DataQueryRequest<Query>;

  it('aligns the grid to the offset of the request range for a fixed timezone', () => {
    // the range carries the UTC+3 offset of its timezone → the grid is shifted by 3h
    const from = dateTimeForTimeZone('Europe/Moscow', T0);
    const to = dateTimeForTimeZone('Europe/Moscow', T0 + 2 * HOUR_MS);
    const bucketing = getRequestVolumeBucketing(request('Europe/Moscow', makeTimeRange(from, to)));
    expect(bucketing).toEqual(getVolumeBucketing(makeTimeRange(from, to), 180));
    expect(bucketing.offset).toBe('3h');
  });

  it('uses the offset of the range start for the browser timezone', () => {
    // a browser-timezone range is a local dateTime, so its offset is the local one at the range start, DST included
    const range = makeRange(T0, T0 + 2 * HOUR_MS);
    const expected = getVolumeBucketing(range, range.from.utcOffset());
    expect(getRequestVolumeBucketing(request('browser', range))).toEqual(expected);
  });

  it('derives the target bar count from the panel width Grafana passes as maxDataPoints', () => {
    const range = makeRange(T0 - HOUR_MS, T0);
    // 1200px → 75 bars → 1h / 75 = 48s → 1m; without a width 96 bars → 30s
    expect(getRequestVolumeBucketing(request('UTC', range, 1200)).step).toBe('1m');
    expect(getRequestVolumeBucketing(request('UTC', range)).step).toBe('30s');
    // 16px per bar, clamped to 24…96 bars: 200px → 24 → 5m, 3000px → 96 → 30s
    expect(getRequestVolumeBucketing(request('UTC', range, 200)).step).toBe('5m');
    expect(getRequestVolumeBucketing(request('UTC', range, 3000)).step).toBe('30s');
  });
});
