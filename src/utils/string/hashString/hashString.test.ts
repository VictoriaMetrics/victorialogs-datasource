import { hashString } from './hashString';

describe('hashString', () => {
  it('is deterministic for the same input', () => {
    expect(hashString('some-query-payload')).toBe(hashString('some-query-payload'));
  });

  it('produces different hashes for different input', () => {
    expect(hashString('foo')).not.toBe(hashString('bar'));
  });

  it('reacts to small changes in the input', () => {
    expect(hashString('{"expr":"info"}')).not.toBe(hashString('{"expr":"error"}'));
  });

  it('handles the empty string', () => {
    expect(typeof hashString('')).toBe('string');
  });

  it('returns a fixed-length 7-character base36 string', () => {
    expect(hashString('some-query-payload')).toMatch(/^[0-9a-z]{7}$/);
  });

  it('pads short hashes to a fixed length', () => {
    // empty string hashes to 0 -> "0", which must be left-padded to 7 chars
    expect(hashString('')).toBe('0000000');
  });

  it('keeps the fixed length for a single-character string', () => {
    expect(hashString('a')).toBe('000002p');
  });

  it('keeps the fixed length for a long (50-character) string', () => {
    expect(hashString('abc'.repeat(50))).toBe('0ih3w74');
  });
});
