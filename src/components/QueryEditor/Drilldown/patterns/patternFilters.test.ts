import { applyPatternFilters, PatternFilter, stripPatternFilterPipes, togglePatternFilter } from './patternFilters';

const include = (pattern: string): PatternFilter => ({ pattern, type: 'include' });
const exclude = (pattern: string): PatternFilter => ({ pattern, type: 'exclude' });

describe('applyPatternFilters', () => {
  it('returns the expression untouched when there are no filters', () => {
    expect(applyPatternFilters('foo | stats count()', [])).toBe('foo | stats count()');
  });

  it('falls back to `*` for an empty expression', () => {
    expect(applyPatternFilters('  ', [include('Product Found')])).toBe(
      '* | filter pattern_match_full("Product Found")'
    );
  });

  it('OR-combines several includes and negates each exclude', () => {
    expect(applyPatternFilters('*', [include('a'), include('b'), exclude('c')])).toBe(
      '* | filter (pattern_match_full("a") OR pattern_match_full("b")) !(pattern_match_full("c"))'
    );
  });
});

describe('stripPatternFilterPipes', () => {
  it('leaves an expression without pattern filters alone', () => {
    expect(stripPatternFilterPipes('foo | stats count()')).toBe('foo | stats count()');
  });

  it('removes an include pipe and keeps the rest of the chain', () => {
    const expr = applyPatternFilters('foo', [include('a')]) + ' | stats count()';
    expect(stripPatternFilterPipes(expr)).toBe('foo | stats count()');
  });

  it('removes an exclude pipe', () => {
    expect(stripPatternFilterPipes(applyPatternFilters('foo', [exclude('a')]))).toBe('foo');
  });

  it('keeps a `filter` pipe that is not a pattern filter', () => {
    expect(stripPatternFilterPipes('foo | filter level:="error"')).toBe('foo | filter level:="error"');
  });

  it('removes a pipe whose pattern contains a `|`', () => {
    const expr = applyPatternFilters('foo', [include('a | b')]);
    expect(stripPatternFilterPipes(expr)).toBe('foo');
  });

  it('makes a repeated Apply idempotent', () => {
    const once = applyPatternFilters('foo', [include('a')]);
    const twice = applyPatternFilters(stripPatternFilterPipes(once), [include('b')]);
    expect(twice).toBe('foo | filter pattern_match_full("b")');
  });

  it('removes the pre-1.33 copy and rename chain', () => {
    const expr = 'foo | copy _msg as __vl_pf_msg | collapse_nums | rename __vl_pf_msg as _msg | stats count()';
    expect(stripPatternFilterPipes(expr)).toBe('foo | stats count()');
  });
});

describe('togglePatternFilter', () => {
  it('adds a filter that is not there yet', () => {
    expect(togglePatternFilter([], 'a', 'include')).toEqual([include('a')]);
  });

  it('removes a filter toggled with the same type', () => {
    expect(togglePatternFilter([include('a')], 'a', 'include')).toEqual([]);
  });

  it('switches the type instead of adding a second filter for the same pattern', () => {
    expect(togglePatternFilter([include('a')], 'a', 'exclude')).toEqual([exclude('a')]);
  });
});
