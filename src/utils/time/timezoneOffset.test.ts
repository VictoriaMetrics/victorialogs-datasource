import { formatOffsetDuration, getTimezoneOffsetMinutes } from './timezoneOffset';

describe('getTimezoneOffsetMinutes', () => {
  it('returns the range offset for an explicit timezone', () => {
    expect(getTimezoneOffsetMinutes('Europe/Berlin', 120)).toBe(120);
    expect(getTimezoneOffsetMinutes('UTC', 0)).toBe(0);
  });

  it('takes the browser offset (with the sign flipped) for the browser timezone', () => {
    expect(getTimezoneOffsetMinutes('browser', 555)).toBe(-new Date().getTimezoneOffset());
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
