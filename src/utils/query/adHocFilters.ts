import { AdHocVariableFilter } from '@grafana/data';

import { splitByPipes } from '../../LogsQL/splitByPipes';
import { LogLevelRule } from '../../configuration/LogLevelRules/types';
import { addLabelToQuery } from '../../modifyQuery';
import { returnVariables } from '../../parsingUtils';
import { AdHocFilter, AdHocFilterOperator, AdHocFiltersMode, Query } from '../../types';

import { buildLevelExprMap } from './levelExpansion';

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

const LEVEL_KEY = 'level';

const isExpandableLevelChip = (f: AdHocFilter): boolean =>
  f.fromLevelFilter === true && f.key === LEVEL_KEY && f.operator === '=';

export interface ExpandedLevelChips {
  levelExpr?: string;
  rest: AdHocFilter[];
}

// Expands marked level chips (set by the level buttons) into a single parenthesised,
// OR-combined LogsQL group. Other chips — including unmarked `level` chips from a
// dashboard adhoc variable or Explore — are returned untouched in `rest`.
export function expandLevelChips(chips: AdHocFilter[], rules: LogLevelRule[]): ExpandedLevelChips {
  const levelChips = chips.filter(isExpandableLevelChip);
  const rest = chips.filter((c) => !isExpandableLevelChip(c));
  if (!levelChips.length) {
    return { rest };
  }
  const exprMap = buildLevelExprMap(rules);
  const exprs: string[] = [];
  levelChips.forEach((chip) => {
    const expr = exprMap[chip.value];
    if (expr) {
      exprs.push(expr);
    } else {
      // Defensive: a marked chip with an unknown value falls back to a plain chip.
      rest.push(chip);
    }
  });
  if (!exprs.length) {
    return { rest };
  }
  return { levelExpr: `(${exprs.join(' OR ')})`, rest };
}

export function serializeChipsForBackend(
  chips: AdHocFilter[] | undefined,
  rules?: LogLevelRule[],
): string | undefined {
  if (!chips?.length) {
    return undefined;
  }
  // When level rules are provided (even []), expand fromLevelFilter chips into LogsQL; otherwise serialize chips literally.
  if (rules) {
    const { levelExpr, rest } = expandLevelChips(chips, rules);
    const restSerialized = serializeAdHocFilters(rest);
    const combined = [levelExpr, restSerialized].filter(Boolean).join(' AND ');
    return combined ? returnVariables(combined) || undefined : undefined;
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
  rules?: LogLevelRule[],
): ResolvedAdHocFilters {
  const mode = resolveAdHocFiltersMode(query);
  const merged = mergeChips(query, dashboardFilters);

  switch (mode) {
    case AdHocFiltersMode.Off:
      // Off disables only dashboard-level ad-hoc injection; panel chips the
      // user added themselves (via the query editor) are preserved.
      return { expr: interpolatedExpr, chips: query.adHocFilters };

    case AdHocFiltersMode.RootQuery: {
      const prefix = serializeChipsForBackend(merged, rules);
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
