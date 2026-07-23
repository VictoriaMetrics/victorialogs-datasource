import { escapeLogsQLQuotedValue, quoteLogsQLValue } from './logsqlEscape';

describe('escapeLogsQLQuotedValue', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeLogsQLQuotedValue('error')).toBe('error');
  });

  it('escapes double quotes', () => {
    expect(escapeLogsQLQuotedValue('say "hi"')).toBe('say \\"hi\\"');
  });

  it('escapes backslashes without double-processing the added quote escapes', () => {
    expect(escapeLogsQLQuotedValue('a\\"b')).toBe('a\\\\\\"b');
  });

  it('converts numbers to strings', () => {
    expect(escapeLogsQLQuotedValue(42)).toBe('42');
  });
});

describe('quoteLogsQLValue', () => {
  it('wraps the escaped value in double quotes', () => {
    expect(quoteLogsQLValue('err"or')).toBe('"err\\"or"');
  });
});
