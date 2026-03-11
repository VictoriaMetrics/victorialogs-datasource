import { splitByPipes } from './splitByPipes';

describe('splitByPipes', () => {
  it('returns single segment for query without pipes', () => {
    expect(splitByPipes('*')).toEqual(['*']);
  });

  it('returns [""] for empty string', () => {
    expect(splitByPipes('')).toEqual(['']);
  });

  it('splits simple query by pipes', () => {
    expect(splitByPipes('* | stats count()')).toEqual(['*', 'stats count()']);
  });

  it('splits multiple pipes', () => {
    expect(splitByPipes('* | keep _msg | sort by (_time)')).toEqual([
      '*',
      'keep _msg',
      'sort by (_time)',
    ]);
  });

  it('trims whitespace around segments', () => {
    expect(splitByPipes('  *  |  keep _msg  ')).toEqual(['*', 'keep _msg']);
  });

  it('does not split pipes inside double quotes', () => {
    expect(splitByPipes('_msg:"a|b" | keep _msg')).toEqual(['_msg:"a|b"', 'keep _msg']);
  });

  it('does not split pipes inside single quotes', () => {
    expect(splitByPipes("_msg:'a|b' | keep _msg")).toEqual(["_msg:'a|b'", 'keep _msg']);
  });

  it('does not split pipes inside backtick quotes', () => {
    expect(splitByPipes('_msg:`a|b` | keep _msg')).toEqual(['_msg:`a|b`', 'keep _msg']);
  });

  it('handles escaped quotes inside double quotes', () => {
    expect(splitByPipes('_msg:"a\\"b|c" | keep _msg')).toEqual(['_msg:"a\\"b|c"', 'keep _msg']);
  });

  it('does not split pipes inside parentheses', () => {
    expect(splitByPipes('* | stats by (a | b) count()')).toEqual(['*', 'stats by (a | b) count()']);
  });

  it('does not split pipes inside curly braces', () => {
    expect(splitByPipes('{app="test|prod"} | keep _msg')).toEqual([
      '{app="test|prod"}',
      'keep _msg',
    ]);
  });

  it('does not split pipes inside nested brackets', () => {
    expect(splitByPipes('* | stats by ({a | b}) count()')).toEqual([
      '*',
      'stats by ({a | b}) count()',
    ]);
  });

  it('handles curly braces inside double quotes as part of string', () => {
    expect(splitByPipes('_msg:"{test}" | keep _msg')).toEqual([
      '_msg:"{test}"',
      'keep _msg',
    ]);
  });

  it('handles parentheses inside double quotes as part of string', () => {
    expect(splitByPipes('_msg:"(test)" | keep _msg')).toEqual([
      '_msg:"(test)"',
      'keep _msg',
    ]);
  });

  it('handles complex real-world query', () => {
    expect(
      splitByPipes('_stream:{app="nginx"} _msg:"error|warn" | stats by (_stream) count() as total | sort by (total) desc')
    ).toEqual([
      '_stream:{app="nginx"} _msg:"error|warn"',
      'stats by (_stream) count() as total',
      'sort by (total) desc',
    ]);
  });

  it('handles query with only pipes', () => {
    expect(splitByPipes('|')).toEqual(['', '']);
    expect(splitByPipes('||')).toEqual(['', '', '']);
  });

  it('handles mixed bracket types', () => {
    expect(splitByPipes('({a|b}) | keep _msg')).toEqual(['({a|b})', 'keep _msg']);
  });

  it('bracket inside the double quotes', () => {
    expect(splitByPipes('fieldName: "abc(" | fieldName2: "abc)"')).toEqual(['fieldName: "abc("', 'fieldName2: "abc)"']);
  });
});
