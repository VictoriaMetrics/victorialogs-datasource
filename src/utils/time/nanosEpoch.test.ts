import { formatNanosEpochToISO } from './nanosEpoch';

describe('formatNanosEpochToISO', () => {
  it('formats a nanosecond-epoch string with the full 9-digit fraction', () => {
    // the value exceeds Number.MAX_SAFE_INTEGER, precision must not be lost
    expect(formatNanosEpochToISO('1700000000000123456')).toBe('2023-11-14T22:13:20.000123456Z');
  });

  it('keeps a zero fraction as nine zeros', () => {
    expect(formatNanosEpochToISO('1700000000000000000')).toBe('2023-11-14T22:13:20.000000000Z');
  });

  it('formats timestamps close to the epoch start', () => {
    expect(formatNanosEpochToISO('123456789')).toBe('1970-01-01T00:00:00.123456789Z');
  });
});
