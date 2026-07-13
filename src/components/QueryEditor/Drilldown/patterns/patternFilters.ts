import { splitByPipes } from '../../../../LogsQL/splitByPipes';
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
 * Appends the pattern filters as one `filter` pipe, so they fit any expression, both the
 * drawer's `*` queries and an editor expression that already contains pipes. The original
 * messages stay untouched, because pattern_match_full matches the collapsed shape in place
 */
export function applyPatternFilters(expr: string, filters: PatternFilter[]): string {
  if (!filters.length) {
    return expr;
  }
  const base = (expr ?? '').trim() || '*';
  return `${base} | filter ${buildPatternFilterExpr(filters)}`;
}

/** A `filter` pipe that applyPatternFilters wrote. It also matches a hand-written equivalent */
const PATTERN_FILTER_PIPE = /^filter\s+!?\(*pattern_match_full\(/;

/** Temp field of the collapse and restore chain used before VictoriaLogs 1.33. Recognized so that an expression an older Apply wrote still cleans up */
const LEGACY_CHAIN_START = ' | copy _msg as __vl_pf_msg';
const LEGACY_CHAIN_END = ' | rename __vl_pf_msg as _msg';

/**
 * Removes a pattern-filter pipe that an earlier Apply appended. This makes "Go to editor"
 * idempotent: the current filters replace the previous ones instead of stacking after them
 */
export function stripPatternFilterPipes(expr: string): string {
  const segments = splitByPipes(stripLegacyChain(expr));
  // the first segment is the filter part, never a pipe, so it always stays
  const kept = segments.filter((segment, i) => i === 0 || !PATTERN_FILTER_PIPE.test(segment));
  return kept.join(' | ').trim();
}

function stripLegacyChain(expr: string): string {
  const start = expr.indexOf(LEGACY_CHAIN_START);
  if (start === -1) {
    return expr;
  }
  const end = expr.indexOf(LEGACY_CHAIN_END, start);
  if (end === -1) {
    return expr;
  }
  return (expr.slice(0, start) + expr.slice(end + LEGACY_CHAIN_END.length)).trim();
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
