import { AdHocVariableFilter } from '@grafana/data';

import { splitByPipes } from '../../LogsQL/splitByPipes';
import { addLabelToQuery } from '../../modifyQuery';
import { returnVariables } from '../../parsingUtils';
import { AdHocFilter, AdHocFilterOperator, AdHocFiltersMode, Query } from '../../types';

export const serializeAdHocFilters = (filters: AdHocFilter[] | undefined): string | undefined => {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  const result = filters.reduce<string>((acc, f) => addLabelToQuery(acc, f), '');
  return result || undefined;
};

export const formatAdHocFilterLabel = (f: AdHocFilter): string => addLabelToQuery('', f);

export const adHocFilterMatches = (f: AdHocFilter, key: string, value: string): boolean =>
  f.key === key && f.value === value;


export const queryHasPipes = (expr: string): boolean => {
  const trimmed = expr.trim();
  if (!trimmed || trimmed === '*') {
    return false;
  }
  return splitByPipes(trimmed).length > 1;
};

export function resolveAdHocFiltersMode(query: Query): AdHocFiltersMode {
  if (query.adHocFiltersMode) {
    return query.adHocFiltersMode;
  }
  return query.isApplyExtraFiltersToRootQuery ? AdHocFiltersMode.RootQuery : AdHocFiltersMode.ExtraFilters;
}

export function serializeChipsForBackend(chips: AdHocFilter[] | undefined): string | undefined {
  if (!chips?.length) {
    return undefined;
  }
  const serialized = serializeAdHocFilters(chips);
  return serialized ? returnVariables(serialized) || undefined : undefined;
}

// Appends a filter as a post-filter pipe (`| filter <expr>`) at the end of the
// query so it runs after the pipes that may produce the filtered field. Used
// for ad-hoc filters whose key is not present in the source data — applying
// such a filter at the source level (via AND) would drop the rows the pipes
// need to produce the field. Falls back to the regular insertion when there is
// nothing for the pipe to act on (empty / `*` / no upstream pipes).
export const appendFilterPipeToQuery = (expr: string, filter: AdHocFilter): string => {
  const trimmed = expr.trim();
  const filterStr = formatAdHocFilterLabel(filter);

  if (!trimmed || trimmed === '*') {
    return filterStr;
  }
  if (!queryHasPipes(trimmed)) {
    return addLabelToQuery(trimmed, filter);
  }
  return `${trimmed} | filter ${filterStr}`;
};

export interface ResolvedAdHocFilters {
  expr: string;
  chips: AdHocFilter[] | undefined;
}

export function resolveAdHocFilters(
  query: Query,
  interpolatedExpr: string,
  dashboardFilters?: AdHocVariableFilter[],
): ResolvedAdHocFilters {
  const mode = resolveAdHocFiltersMode(query);
  const merged = mergeChips(query, dashboardFilters);

  switch (mode) {
    case AdHocFiltersMode.Off:
      // Off disables only dashboard-level ad-hoc injection; panel chips the
      // user added themselves (via the query editor) are preserved.
      return { expr: interpolatedExpr, chips: query.adHocFilters };

    case AdHocFiltersMode.RootQuery: {
      const prefix = serializeChipsForBackend(merged);
      return {
        expr: prefix ? `${prefix} | ${interpolatedExpr}` : interpolatedExpr,
        chips: undefined,
      };
    }

    case AdHocFiltersMode.ExtraFilters:
      return {
        expr: interpolatedExpr,
        chips: merged.length ? merged : undefined,
      };
  }
}

function mergeChips(query: Query, dashboardFilters?: AdHocVariableFilter[]): AdHocFilter[] {
  const dashboardChips: AdHocFilter[] = (dashboardFilters ?? []).map((f) => ({
    key: f.key,
    operator: f.operator as AdHocFilterOperator,
    value: f.value,
  }));
  return [...(query.adHocFilters ?? []), ...dashboardChips];
}
