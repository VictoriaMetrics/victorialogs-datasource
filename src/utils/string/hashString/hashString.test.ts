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

  it('returns a base36 string', () => {
    expect(hashString('some-query-payload')).toMatch(/^[0-9a-z]+$/);
  });

  it('hashes known values', () => {
    expect(hashString('')).toBe('0');
    expect(hashString('a')).toBe('2p');
    expect(hashString('abc'.repeat(50))).toBe('ih3w74');
  });
});
