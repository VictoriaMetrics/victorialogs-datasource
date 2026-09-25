import { AdHocFilter } from '../../../types';
import { isLevelChip } from '../../../utils/query/levelChips';

import { PatternFilter } from './patterns/patternFilters';

/**
 * Whether the drawer is narrowed to a selection, i.e. whether the details view
 * (level 2) is open. Any ad-hoc chip counts, whatever its field and operator, and so does any
 * pattern include or exclude. Level chips are the exception: they narrow the current selection
 * without drilling in
 */
export const hasDrilldownSelection = (filters: AdHocFilter[], patternFilters: PatternFilter[]): boolean =>
  filters.some((f) => !isLevelChip(f)) || patternFilters.length > 0;
