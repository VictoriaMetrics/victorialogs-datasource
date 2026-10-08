import moment from 'moment-timezone';

import { dateTimeForTimeZone, makeTimeRange, setTimeZoneResolver, TimeRange, toUtc } from '@grafana/data';

import { formatOffsetDuration, getRangeStartOffsetMinutes } from './timezoneOffset';

describe('getRangeStartOffsetMinutes', () => {
  // 2026-09-21T10:20:00Z: CEST (UTC+2) in Berlin, MSK (UTC+3) in Moscow
  const T0 = Date.UTC(2026, 8, 21, 10, 20);
  // 2026-01-21T10:20:00Z: CET (UTC+1) in Berlin
  const T_WINTER = Date.UTC(2026, 0, 21, 10, 20);

  /** An absolute range from the Explore URL: Grafana parses its epoch bounds as UTC, whatever the timezone */
  const absoluteRange = (fromMs: number): TimeRange => makeTimeRange(toUtc(fromMs), toUtc(fromMs + 3_600_000));

  it('takes the offset of a named timezone even when the range is parsed as UTC', () => {
    const range = absoluteRange(T0);
    expect(range.from.utcOffset()).toBe(0);
    expect(getRangeStartOffsetMinutes('Europe/Moscow', range)).toBe(180);
  });

  it('applies the DST rule of the timezone at the range start', () => {
    expect(getRangeStartOffsetMinutes('Europe/Berlin', absoluteRange(T0))).toBe(120);
    expect(getRangeStartOffsetMinutes('Europe/Berlin', absoluteRange(T_WINTER))).toBe(60);
  });

  it('matches the offset Grafana attaches to a relative range of the same timezone', () => {
    const range = makeTimeRange(dateTimeForTimeZone('Europe/Moscow', T0), dateTimeForTimeZone('Europe/Moscow', T0 + 3_600_000));
    expect(getRangeStartOffsetMinutes('Europe/Moscow', range)).toBe(range.from.utcOffset());
  });

  it('returns 0 for utc', () => {
    expect(getRangeStartOffsetMinutes('utc', absoluteRange(T0))).toBe(0);
  });

  describe('browser timezone', () => {
    let guess: jest.SpyInstance;

    beforeEach(() => {
      guess = jest.spyOn(moment.tz, 'guess').mockReturnValue('Europe/Berlin');
    });

    afterEach(() => {
      guess.mockRestore();
    });

    it('resolves the local timezone of the browser instead of trusting the UTC range', () => {
      expect(getRangeStartOffsetMinutes('browser', absoluteRange(T0))).toBe(120);
      expect(getRangeStartOffsetMinutes('browser', absoluteRange(T_WINTER))).toBe(60);
    });
  });

  describe('default (empty) timezone', () => {
    afterEach(() => {
      setTimeZoneResolver(() => 'browser');
    });

    it('resolves the timezone of the Grafana user', () => {
      setTimeZoneResolver(() => 'Europe/Moscow');
      expect(getRangeStartOffsetMinutes('', absoluteRange(T0))).toBe(180);
    });
  });

  it('falls back to the range offset for a timezone Grafana does not know', () => {
    const range = makeTimeRange(dateTimeForTimeZone('Asia/Kolkata', T0), dateTimeForTimeZone('Asia/Kolkata', T0 + 3_600_000));
    expect(getRangeStartOffsetMinutes('Mars/Olympus_Mons', range)).toBe(330);
  });
});

describe('formatOffsetDuration', () => {
  it('should return undefined for 0', () => {
    expect(formatOffsetDuration(0)).toBeUndefined();
  });

  it('should format positive hours "2h"', () => {
    expect(formatOffsetDuration(120)).toBe('2h');
  });

  it('should format negative hours "-5h"', () => {
    expect(formatOffsetDuration(-300)).toBe('-5h');
  });

  it('should format hours and minutes "5h30m"', () => {
    expect(formatOffsetDuration(330)).toBe('5h30m');
  });

  it('should format negative hours and minutes "-5h30m"', () => {
    expect(formatOffsetDuration(-330)).toBe('-5h30m');
  });

  it('should format minutes only "30m"', () => {
    expect(formatOffsetDuration(30)).toBe('30m');
  });

  it('should format negative minutes only "-45m"', () => {
    expect(formatOffsetDuration(-45)).toBe('-45m');
  });

  it('should format "5h45m" for Nepal timezone offset', () => {
    expect(formatOffsetDuration(345)).toBe('5h45m');
  });
});
