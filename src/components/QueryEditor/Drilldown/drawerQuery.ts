import { AdHocFilter, Query } from '../../../types';

import { applyPatternFilters, PatternFilter } from './patterns/patternFilters';

/**
 * Builds the query the drawer runs, which is also what "Go to editor" applies. The drilldown
 * deliberately ignores the editor's narrowing (its expression and stream filters) and explores
 * the whole stream (`*`) through its own chips and pattern filters only, so the editor's
 * original expression and stream filters are replaced rather than merged
 */
export function buildDrawerQuery(query: Query, filters: AdHocFilter[], patternFilters: PatternFilter[]): Query {
  return {
    ...query,
    expr: applyPatternFilters('*', patternFilters),
    adHocFilters: filters.length ? filters : undefined,
    streamFilters: undefined,
  };
}
