import { FilterActionType, StreamFilterOperator, StreamFilterState } from '../../types';

/** Resolves the group operator; legacy saved groups without one were always `in` */
export const streamFilterOperator = (filter: StreamFilterState): StreamFilterOperator => filter.operator ?? 'in';

/** Returns true for an `in` group (the only kind the stream filters popover edits) */
export const isInGroup = (filter: StreamFilterState): boolean => streamFilterOperator(filter) === 'in';

const findGroup = (filters: StreamFilterState[], label: string, operator: StreamFilterOperator) =>
  filters.findIndex((f) => f.label === label && streamFilterOperator(f) === operator);

/** Returns true when the label's `in` group contains the value (used for the active filter-icon state) */
export function streamFiltersHaveValue(filters: StreamFilterState[], label: string, value: string): boolean {
  return filters.some((f) => f.label === label && streamFilterOperator(f) === 'in' && f.values.includes(value));
}

function removeValue(
  filters: StreamFilterState[],
  label: string,
  value: string,
  operator: StreamFilterOperator
): StreamFilterState[] {
  const idx = findGroup(filters, label, operator);
  if (idx === -1 || !filters[idx].values.includes(value)) {
    return filters;
  }
  const values = filters[idx].values.filter((v) => v !== value);
  return values.length
    ? filters.map((f, i) => (i === idx ? { ...f, values } : f))
    : filters.filter((_, i) => i !== idx);
}

function addValue(
  filters: StreamFilterState[],
  label: string,
  value: string,
  operator: StreamFilterOperator
): StreamFilterState[] {
  const idx = findGroup(filters, label, operator);
  if (idx === -1) {
    return [...filters, { label, operator, values: [value] }];
  }
  if (filters[idx].values.includes(value)) {
    return filters;
  }
  return filters.map((f, i) => (i === idx ? { ...f, values: [...f.values, value] } : f));
}

/**
 * Applies a Filter for / Filter out click on a stream field to the stream filters.
 *
 * FILTER_FOR toggles the value in the label's `in` group (second click removes it)
 * and clears it from the `not_in` group so the groups never contradict each other.
 * FILTER_OUT adds the value to the `not_in` group (idempotent) and removes it from
 * the `in` group. Empty groups are dropped.
 */
export function toggleStreamFilterValue(
  filters: StreamFilterState[],
  type: FilterActionType,
  label: string,
  value: string
): StreamFilterState[] {
  if (type === FilterActionType.FILTER_FOR) {
    if (streamFiltersHaveValue(filters, label, value)) {
      return removeValue(filters, label, value, 'in');
    }
    return addValue(removeValue(filters, label, value, 'not_in'), label, value, 'in');
  }
  return addValue(removeValue(filters, label, value, 'in'), label, value, 'not_in');
}
