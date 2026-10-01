import { formatOffsetDuration } from './timezoneOffset';

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
