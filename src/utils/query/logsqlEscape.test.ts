import { escapeLogsQLQuotedValue, quoteLogsQLValue } from './logsqlEscape';

describe('escapeLogsQLQuotedValue', () => {
  it('escapes backslashes, newlines and double quotes', () => {
    expect(escapeLogsQLQuotedValue('a"b\\c\nd')).toBe('a\\"b\\\\c\\nd');
  });

  it('returns plain values unchanged', () => {
    expect(escapeLogsQLQuotedValue('nginx')).toBe('nginx');
  });

  it('escapes newlines so the literal stays valid Go-style syntax', () => {
    expect(escapeLogsQLQuotedValue('a\nb')).toBe('a\\nb');
  });
});

describe('quoteLogsQLValue', () => {
  it('wraps the escaped value in double quotes', () => {
    expect(quoteLogsQLValue('a"b')).toBe('"a\\"b"');
  });
});
