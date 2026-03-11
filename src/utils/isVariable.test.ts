import { isVariable } from './isVariable';

describe('isVariable', () => {
  it('returns true when value starts with $', () => {
    expect(isVariable('$variable')).toBe(true);
  });

  it('returns false when value does not start with $', () => {
    expect(isVariable('variable')).toBe(false);
  });

  it('returns false for $ only', () => {
    expect(isVariable('$')).toBe(false);
  });

  it('returns true for 1 char variable', () => {
    expect(isVariable('$c')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isVariable('')).toBe(false);
  });

  it('returns false when $ is not at the start', () => {
    expect(isVariable('test$variable')).toBe(false);
  });
});
