import { AdHocFilter, Query } from '../../../types';

import { applyPatternFilters, PatternFilter } from './patterns/patternFilters';

/**
 * Builds the query the drawer runs. The drilldown deliberately ignores the editor's narrowing
 * (its expression and stream filters) and explores the whole stream (`*`) through its own
 * chips and pattern filters only
 */
export function buildDrawerQuery(query: Query, filters: AdHocFilter[], patternFilters: PatternFilter[]): Query {
  return { ...query, expr: applyPatternFilters('*', patternFilters), adHocFilters: filters, streamFilters: undefined };
}

/**
 * Turns the drawer query into the editor query that "Go to editor" applies. What the drawer
 * shows is exactly what the editor gets, so the editor's original expression and stream filters
 * are replaced rather than merged
 */
export function toEditorQuery(drawerQuery: Query): Query {
  const filters = drawerQuery.adHocFilters ?? [];
  return { ...drawerQuery, adHocFilters: filters.length ? filters : undefined };
}
