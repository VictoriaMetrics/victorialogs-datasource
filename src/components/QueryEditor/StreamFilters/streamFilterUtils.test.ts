import { buildStreamExtraFilters, streamFilterToString } from './streamFilterUtils';

describe('streamFilterToString', () => {
  it('serializes a simple label unquoted', () => {
    expect(streamFilterToString({ label: 'app', operator: 'in', values: ['nginx'] })).toBe(
      '_stream:{app in ("nginx")}'
    );
  });

  it('keeps labels with dots and dashes unquoted', () => {
    expect(streamFilterToString({ label: 'kubernetes.pod-name', operator: 'in', values: ['web-1'] })).toBe(
      '_stream:{kubernetes.pod-name in ("web-1")}'
    );
  });

  it('quotes a label containing a space', () => {
    expect(streamFilterToString({ label: 'foo bar', operator: 'in', values: ['x'] })).toBe(
      '_stream:{"foo bar" in ("x")}'
    );
  });

  it('quotes a label in a not_in group', () => {
    expect(streamFilterToString({ label: 'foo bar', operator: 'not_in', values: ['x'] })).toBe(
      '_stream:{"foo bar" not_in ("x")}'
    );
  });

  it('escapes quotes and backslashes in a quoted label', () => {
    expect(streamFilterToString({ label: 'foo "bar"\\', operator: 'in', values: ['x'] })).toBe(
      '_stream:{"foo \\"bar\\"\\\\" in ("x")}'
    );
  });

  it('passes a variable label through unquoted', () => {
    expect(streamFilterToString({ label: '$field', operator: 'in', values: ['x'] })).toBe(
      '_stream:{$field in ("x")}'
    );
  });

  it('returns an empty string without a label or values', () => {
    expect(streamFilterToString({ label: '', operator: 'in', values: ['x'] })).toBe('');
    expect(streamFilterToString({ label: 'app', operator: 'in', values: [] })).toBe('');
  });
});

describe('buildStreamExtraFilters', () => {
  it('joins filters with AND and quotes labels where needed', () => {
    expect(
      buildStreamExtraFilters([
        { label: 'app', operator: 'in', values: ['nginx'] },
        { label: 'foo bar', operator: 'not_in', values: ['x', 'y'] },
      ])
    ).toBe('_stream:{app in ("nginx")} AND _stream:{"foo bar" not_in ("x", "y")}');
  });
});
