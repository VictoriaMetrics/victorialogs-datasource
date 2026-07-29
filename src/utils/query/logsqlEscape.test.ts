import { escapeLogsQLQuotedValue, quoteLogsQLFieldName, quoteLogsQLValue } from './logsqlEscape';

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

  it('converts numbers to strings', () => {
    expect(escapeLogsQLQuotedValue(42)).toBe('42');
  });
});

describe('quoteLogsQLValue', () => {
  it('wraps the escaped value in double quotes', () => {
    expect(quoteLogsQLValue('a"b')).toBe('"a\\"b"');
  });
});

describe('quoteLogsQLFieldName', () => {
  it('returns plain field names unchanged', () => {
    expect(quoteLogsQLFieldName('kubernetes.pod_name1')).toBe('kubernetes.pod_name1');
  });

  it('quotes field names with special characters', () => {
    expect(quoteLogsQLFieldName('log:level')).toBe('"log:level"');
    expect(quoteLogsQLFieldName('field name')).toBe('"field name"');
  });

  it('quotes an empty field name', () => {
    expect(quoteLogsQLFieldName('')).toBe('""');
  });
});
