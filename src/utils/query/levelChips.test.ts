import { AdHocFilter } from '../../types';

import { isLevelChip, matchesLevelChip, toggleLevelChip } from './levelChips';

const levelChip = (level: string): AdHocFilter => ({ key: 'level', operator: '=', value: level, fromLevelFilter: true });

describe('isLevelChip', () => {
  it('accepts only marked `level =` chips', () => {
    expect(isLevelChip(levelChip('error'))).toBe(true);
    // a manual chip on the same key stays a plain filter
    expect(isLevelChip({ key: 'level', operator: '=', value: 'error' })).toBe(false);
    expect(isLevelChip({ key: 'level', operator: '!=', value: 'error', fromLevelFilter: true })).toBe(false);
    expect(isLevelChip({ key: 'app', operator: '=', value: 'error', fromLevelFilter: true })).toBe(false);
  });
});

describe('matchesLevelChip', () => {
  it('matches the marked chip of the given level only', () => {
    expect(matchesLevelChip(levelChip('error'), 'error')).toBe(true);
    expect(matchesLevelChip(levelChip('warning'), 'error')).toBe(false);
    expect(matchesLevelChip({ key: 'level', operator: '=', value: 'error' }, 'error')).toBe(false);
  });
});

describe('toggleLevelChip', () => {
  it('appends the marked chip when the level is not selected', () => {
    const existing: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'web' }];
    expect(toggleLevelChip(existing, 'error')).toEqual([...existing, levelChip('error')]);
  });

  it('removes the marked chip when the level is already selected', () => {
    const filters = [levelChip('error'), levelChip('warning')];
    expect(toggleLevelChip(filters, 'error')).toEqual([levelChip('warning')]);
  });

  it('leaves an unmarked chip of the same level untouched', () => {
    const manual: AdHocFilter = { key: 'level', operator: '=', value: 'error' };
    expect(toggleLevelChip([manual], 'error')).toEqual([manual, levelChip('error')]);
  });
});
