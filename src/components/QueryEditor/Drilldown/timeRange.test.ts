import { dateTime, TimeRange } from '@grafana/data';

import { isSameTimeRange } from './timeRange';

const relative = (from: string, to: string, resolvedFrom: number, resolvedTo: number): TimeRange => ({
  from: dateTime(resolvedFrom),
  to: dateTime(resolvedTo),
  raw: { from, to },
});

const absolute = (from: number, to: number): TimeRange => {
  const range = { from: dateTime(from), to: dateTime(to) };
  return { ...range, raw: range };
};

describe('isSameTimeRange', () => {
  it('matches a re-picked relative range that resolved to later timestamps', () => {
    expect(isSameTimeRange(relative('now-1h', 'now', 1000, 2000), relative('now-1h', 'now', 1500, 2500))).toBe(true);
  });

  it('does not match different relative ranges', () => {
    expect(isSameTimeRange(relative('now-1h', 'now', 1000, 2000), relative('now-6h', 'now', 1000, 2000))).toBe(false);
  });

  it('matches absolute ranges by time, whatever the raw form', () => {
    const asStrings: TimeRange = { ...absolute(1000, 2000), raw: { from: '1000', to: '2000' } };
    expect(isSameTimeRange(absolute(1000, 2000), asStrings)).toBe(true);
  });

  it('does not match absolute ranges with different bounds', () => {
    expect(isSameTimeRange(absolute(1000, 2000), absolute(1000, 3000))).toBe(false);
  });

  it('does not match a relative range against its absolute snapshot', () => {
    expect(isSameTimeRange(relative('now-1h', 'now', 1000, 2000), absolute(1000, 2000))).toBe(false);
  });
});
