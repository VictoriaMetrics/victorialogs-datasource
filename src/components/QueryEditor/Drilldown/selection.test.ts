import { AdHocFilter, AdHocFilterOperator } from '../../../types';

import { PatternFilter } from './patterns/patternFilters';
import { hasDrilldownSelection } from './selection';

const levelChip = (level: string): AdHocFilter => ({
  key: 'level',
  operator: '=',
  value: level,
  fromLevelFilter: true,
});

const pattern = (p: string, type: PatternFilter['type'] = 'include'): PatternFilter => ({ pattern: p, type });

describe('hasDrilldownSelection', () => {
  it('is false with nothing selected', () => {
    expect(hasDrilldownSelection([], [])).toBe(false);
  });

  it('is false for level chips alone', () => {
    expect(hasDrilldownSelection([levelChip('error'), levelChip('warning')], [])).toBe(false);
  });

  it.each([
    ['equals', '='],
    ['not equals', '!='],
    ['regex match', '=~'],
    ['regex not match', '!~'],
  ] as const)('is true for a %s chip on any field', (_name, operator: AdHocFilterOperator) => {
    expect(hasDrilldownSelection([{ key: 'app', operator, value: 'web' }], [])).toBe(true);
  });

  it('is true for a literal level chip that did not come from the level buttons', () => {
    expect(hasDrilldownSelection([{ key: 'level', operator: '=', value: 'error' }], [])).toBe(true);
  });

  it.each([['include'], ['exclude']] as const)('is true for a %s pattern filter alone', (type) => {
    expect(hasDrilldownSelection([], [pattern('foo <N>', type)])).toBe(true);
  });

  it('is true for a level chip combined with a pattern filter', () => {
    expect(hasDrilldownSelection([levelChip('error')], [pattern('foo <N>')])).toBe(true);
  });
});
