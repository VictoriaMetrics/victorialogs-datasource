import { escapeLabelValueInSelector } from '../../../../languageUtils';

export interface PatternFilter {
  pattern: string;
  type: 'include' | 'exclude';
}

/**
 * Matches the whole _msg against a collapse_nums-style pattern. This is a plain filter, with
 * no copy, collapse and restore round trip. It requires VictoriaLogs 1.33 or newer
 */
const matchExpr = (f: PatternFilter) => `pattern_match_full("${escapeLabelValueInSelector(f.pattern)}")`;

/**
 * Builds the LogsQL filter expression for the pattern filters. It combines the includes with
 * OR, and negates each exclude and combines them with the implicit AND of juxtaposition
 */
function buildPatternFilterExpr(filters: PatternFilter[]): string {
  const includes = filters.filter((f) => f.type === 'include');
  const excludes = filters.filter((f) => f.type === 'exclude');
  const parts: string[] = [];
  if (includes.length) {
    parts.push(includes.length > 1 ? `(${includes.map(matchExpr).join(' OR ')})` : matchExpr(includes[0]));
  }
  parts.push(...excludes.map((f) => `!(${matchExpr(f)})`));
  return parts.join(' ');
}

/**
 * Appends the pattern filters to the drawer's base expression as one `filter` pipe. The
 * original messages stay untouched, because pattern_match_full matches the collapsed shape in
 * place. It is not meant for editor expressions with their own pipes: "Go to editor" replaces
 * the editor expression with the drawer's one instead of appending to it
 */
export function applyPatternFilters(expr: string, filters: PatternFilter[]): string {
  if (!filters.length) {
    return expr;
  }
  const base = (expr ?? '').trim() || '*';
  return `${base} | filter ${buildPatternFilterExpr(filters)}`;
}

/** Toggles the pattern: the same type removes the filter, a different type switches it */
export function togglePatternFilter(
  filters: PatternFilter[],
  pattern: string,
  type: PatternFilter['type']
): PatternFilter[] {
  const existing = filters.find((f) => f.pattern === pattern);
  const rest = filters.filter((f) => f.pattern !== pattern);
  if (existing?.type === type) {
    return rest;
  }
  return [...rest, { pattern, type }];
}
