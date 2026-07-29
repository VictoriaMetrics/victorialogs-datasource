import { capitalize } from './capitalize';

describe('capitalize', () => {
  it('capitalizes the first letter of a lowercase string', () => {
    expect(capitalize('info')).toBe('Info');
  });

  it('keeps already-capitalized and non-letter strings unchanged', () => {
    expect(capitalize('INFO')).toBe('INFO');
    expect(capitalize('42')).toBe('42');
    expect(capitalize('')).toBe('');
  });

  it('does not touch letters after the first one', () => {
    expect(capitalize('vICTORIA')).toBe('VICTORIA');
  });
});
