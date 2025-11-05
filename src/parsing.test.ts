import { removeDoubleQuotesAroundVar } from './parsing';

describe('removeDoubleQuotesAroundVar', () => {
  it('should remove double quotes around the variable name', () => {
    const query = `"text" and "$var"`;
    const result = removeDoubleQuotesAroundVar(query, 'var');
    expect(result).toBe('"text" and $var');
  });

  it('should not remove double quotes if the variable name does not match', () => {
    const query = `"text" and "$otherVar"`;
    const result = removeDoubleQuotesAroundVar(query, 'var');
    expect(result).toBe(`"text" and "$otherVar"`);
  });

  it('should not modify variables that already have no quotes', () => {
    const query = `"text" and $var`;
    const result = removeDoubleQuotesAroundVar(query, 'var');
    expect(result).toBe(`"text" and $var`);
  });

  it('should not remove double quotes if preceded by a tilde (~)', () => {
    const query = `"text" and ~"$var"`;
    const result = removeDoubleQuotesAroundVar(query, 'var');
    expect(result).toBe(`"text" and ~"$var"`);
  });

  it('should handle multiple occurrences of the same variable', () => {
    const query = `"$var" and "$var"`;
    const result = removeDoubleQuotesAroundVar(query, 'var');
    expect(result).toBe(`$var and $var`);
  });

  it('should leave the string unmodified if no matching variable is found', () => {
    const query = `"text" and "$differentVar"`;
    const result = removeDoubleQuotesAroundVar(query, 'var');
    expect(result).toBe(`"text" and "$differentVar"`);
  });

  it('should handle an empty query string gracefully', () => {
    const query = ``;
    const result = removeDoubleQuotesAroundVar(query, 'var');
    expect(result).toBe(``);
  });

  it('should handle an empty variable name gracefully', () => {
    const query = `"$var" and "$otherVar"`;
    const result = removeDoubleQuotesAroundVar(query, '');
    expect(result).toBe(`"$var" and "$otherVar"`);
  });
});
