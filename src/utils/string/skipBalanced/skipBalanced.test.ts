import { skipBalanced } from './skipBalanced';

describe('skipBalanced', () => {
  it('returns the index just past a simple block', () => {
    expect(skipBalanced('{a}', 0, '{', '}')).toBe(3);
    expect(skipBalanced('(a)', 0, '(', ')')).toBe(3);
  });

  it('handles an empty block', () => {
    expect(skipBalanced('{}', 0, '{', '}')).toBe(2);
  });

  it('handles nested blocks', () => {
    expect(skipBalanced('{a{b}c}', 0, '{', '}')).toBe(7);
    expect(skipBalanced('(a(b)(c))d', 0, '(', ')')).toBe(9);
  });

  it('lets the result slice off the block, leaving the remainder', () => {
    const expr = '{app="x"} | stats count()';
    expect(expr.slice(skipBalanced(expr, 0, '{', '}'))).toBe(' | stats count()');
  });

  it('ignores close chars inside double-quoted strings', () => {
    expect(skipBalanced('{a"}"b}', 0, '{', '}')).toBe(7);
    expect(skipBalanced('{app="a}b"}', 0, '{', '}')).toBe(11);
  });

  it('ignores close chars inside single-quoted and backtick strings', () => {
    expect(skipBalanced("(a')'b)", 0, '(', ')')).toBe(7);
    expect(skipBalanced('{a`}`b}', 0, '{', '}')).toBe(7);
  });

  it('treats a backslash inside a quote as escaping the next char', () => {
    // `{"\""}` — the escaped quote must not end the string early
    expect(skipBalanced('{"\\""}', 0, '{', '}')).toBe(6);
  });

  it('returns the string length when the block is never closed', () => {
    expect(skipBalanced('{abc', 0, '{', '}')).toBe(4);
    expect(skipBalanced('{a{b}c', 0, '{', '}')).toBe(6);
  });

  it('starts scanning at openIdx, ignoring earlier characters', () => {
    expect(skipBalanced('foo{a}', 3, '{', '}')).toBe(6);
  });
});
