import { AdHocFilter, FilterActionType, StreamFilterState } from '../../types';

import { adHocFilterValues, isExactInFilter, isExactOutFilter } from './adHocFilters';
import { toggleStreamFilterValue } from './streamFilterToggle';

// Level chips (added by the level buttons) keep single-chip semantics: their
// LogsQL expansion requires a lone `=` chip per value, so they never join groups
const isGroupable = (f: AdHocFilter): boolean =>
  !f.fromLevelFilter && (isExactInFilter(f) || isExactOutFilter(f));

// Collapses the key's exact-match chips into at most one `in` and one `not_in`
// group so the stream filter toggle can operate on them
const toGroups = (key: string, chips: AdHocFilter[]): StreamFilterState[] => {
  const groups: StreamFilterState[] = [];
  for (const operator of ['in', 'not_in'] as const) {
    const matching = chips.filter((c) => (operator === 'in' ? isExactInFilter(c) : isExactOutFilter(c)));
    if (matching.length) {
      groups.push({ label: key, operator, values: Array.from(new Set(matching.flatMap(adHocFilterValues))) });
    }
  }
  return groups;
};

const toChip = (group: StreamFilterState): AdHocFilter => ({
  key: group.label,
  operator: group.operator === 'not_in' ? '!=|' : '=|',
  value: group.values[0],
  values: group.values,
});

/**
 * Applies a Filter for / Filter out click to the ad-hoc chips with the same
 * group semantics as stream filters: exact-match chips of the key (`=`, `=|`,
 * `!=`, `!=|`) are collapsed into an `in` and a `not_in` group and the value is
 * toggled between them. Legacy single-value chips are normalized into groups on
 * the first toggle of their key. Regex/range chips are left untouched; a level
 * chip matching the clicked value is removed in both directions, preserving its
 * single-chip toggle behaviour.
 */
export function toggleAdHocFilterValue(
  filters: AdHocFilter[],
  type: FilterActionType,
  key: string,
  value: string
): AdHocFilter[] {
  const rest: AdHocFilter[] = [];
  const groupable: AdHocFilter[] = [];
  let levelChipRemoved = false;

  for (const f of filters) {
    if (f.fromLevelFilter && f.key === key && f.value === value) {
      levelChipRemoved = true;
      continue;
    }
    (isGroupable(f) && f.key === key ? groupable : rest).push(f);
  }

  // Removing the matching level chip IS the toggle-off for Filter for; Filter
  // out additionally excludes the value via the not_in group below
  if (type === FilterActionType.FILTER_FOR && levelChipRemoved) {
    return [...rest, ...groupable];
  }

  const nextGroups = toggleStreamFilterValue(toGroups(key, groupable), type, key, value);
  return [...rest, ...nextGroups.map(toChip)];
}

/** Returns true when an in-semantics chip of the key (`=`, `=|`, incl. level chips) contains the value (drives the active filter-icon state) */
export function adHocFiltersHaveValue(filters: AdHocFilter[], key: string, value: string): boolean {
  return filters.some((f) => f.key === key && isExactInFilter(f) && adHocFilterValues(f).includes(value));
}
