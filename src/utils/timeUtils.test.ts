import {
  formatOffsetDuration,
  getDurationFromMilliseconds,
  getMillisecondsFromDuration,
} from './timeUtils';

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
});
