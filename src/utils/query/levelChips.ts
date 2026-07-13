import { AdHocFilter } from '../../types';

export const LEVEL_KEY = 'level';

/**
 * Chip created by the level filter buttons — marked with `fromLevelFilter` so
 * serialization expands it into the exact per-level LogsQL expression instead
 * of a literal `level:="value"` filter (see expandLevelChips)
 */
export const isLevelChip = (f: AdHocFilter): boolean =>
  f.fromLevelFilter === true && f.key === LEVEL_KEY && f.operator === '=';

export const matchesLevelChip = (f: AdHocFilter, level: string): boolean => isLevelChip(f) && f.value === level;

/** Adds the marked chip for `level`, or removes it when already present */
export const toggleLevelChip = (filters: AdHocFilter[], level: string): AdHocFilter[] =>
  filters.some((f) => matchesLevelChip(f, level))
    ? filters.filter((f) => !matchesLevelChip(f, level))
    : [...filters, { key: LEVEL_KEY, operator: '=', value: level, fromLevelFilter: true }];
