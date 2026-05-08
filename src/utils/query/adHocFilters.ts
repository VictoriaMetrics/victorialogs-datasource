import { splitByPipes } from '../../LogsQL/splitByPipes';
import { addLabelToQuery } from '../../modifyQuery';
import { AdHocFilter } from '../../types';

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
