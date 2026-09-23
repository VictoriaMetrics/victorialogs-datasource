import { applyPatternFilters, PatternFilter, togglePatternFilter } from './patternFilters';

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

  it('escapes double quotes in the pattern', () => {
    expect(applyPatternFilters('*', [include('say "hi" <N>')])).toBe(
      '* | filter pattern_match_full("say \\"hi\\" <N>")'
    );
  });

  it('escapes backslashes in the pattern', () => {
    expect(applyPatternFilters('*', [include('C:\\temp\\<N>')])).toBe(
      '* | filter pattern_match_full("C:\\\\temp\\\\<N>")'
    );
  });

  it('escapes newlines in the pattern', () => {
    expect(applyPatternFilters('*', [exclude('line1\nline2')])).toBe(
      '* | filter !(pattern_match_full("line1\\nline2"))'
    );
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
