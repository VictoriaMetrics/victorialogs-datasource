import { AdHocFilter, FilterActionType } from '../../types';

import { adHocFiltersHaveValue, toggleAdHocFilterValue } from './adHocFilterToggle';

const inChip = (key: string, values: string[]): AdHocFilter => ({
  key,
  operator: '=|',
  value: values[0],
  values,
});

const notInChip = (key: string, values: string[]): AdHocFilter => ({
  key,
  operator: '!=|',
  value: values[0],
  values,
});

const levelChip = (value: string): AdHocFilter => ({
  key: 'level',
  operator: '=',
  value,
  fromLevelFilter: true,
});

describe('toggleAdHocFilterValue', () => {
  describe('FILTER_FOR', () => {
    it('creates an in-group chip for a new key', () => {
      expect(toggleAdHocFilterValue([], FilterActionType.FILTER_FOR, 'app', 'nginx')).toEqual([
        inChip('app', ['nginx']),
      ]);
    });

    it('merges a second value of the same key into one chip', () => {
      const next = toggleAdHocFilterValue([inChip('app', ['nginx'])], FilterActionType.FILTER_FOR, 'app', 'apache');
      expect(next).toEqual([inChip('app', ['nginx', 'apache'])]);
    });

    it('toggles the value off on the second click and drops the empty chip', () => {
      const next = toggleAdHocFilterValue([inChip('app', ['nginx'])], FilterActionType.FILTER_FOR, 'app', 'nginx');
      expect(next).toEqual([]);
    });

    it('normalizes legacy single-value = chips of the key into one group', () => {
      const legacy: AdHocFilter[] = [
        { key: 'app', operator: '=', value: 'nginx' },
        { key: 'app', operator: '=', value: 'apache' },
      ];
      const next = toggleAdHocFilterValue(legacy, FilterActionType.FILTER_FOR, 'app', 'caddy');
      expect(next).toEqual([inChip('app', ['nginx', 'apache', 'caddy'])]);
    });

    it('moves the value from the not_in chip to the in chip', () => {
      const next = toggleAdHocFilterValue([notInChip('app', ['nginx'])], FilterActionType.FILTER_FOR, 'app', 'nginx');
      expect(next).toEqual([inChip('app', ['nginx'])]);
    });

    it('removes a matching level chip instead of touching groups', () => {
      const filters = [levelChip('error'), inChip('app', ['nginx'])];
      const next = toggleAdHocFilterValue(filters, FilterActionType.FILTER_FOR, 'level', 'error');
      expect(next).toEqual([inChip('app', ['nginx'])]);
    });

    it('leaves regex/range chips of the same key untouched', () => {
      const regex: AdHocFilter = { key: 'app', operator: '=~', value: 'ngin.*' };
      const next = toggleAdHocFilterValue([regex], FilterActionType.FILTER_FOR, 'app', 'nginx');
      expect(next).toEqual([regex, inChip('app', ['nginx'])]);
    });

    it('leaves chips of other keys untouched', () => {
      const other = inChip('env', ['dev']);
      const next = toggleAdHocFilterValue([other], FilterActionType.FILTER_FOR, 'app', 'nginx');
      expect(next).toEqual([other, inChip('app', ['nginx'])]);
    });
  });

  describe('FILTER_OUT', () => {
    it('creates a not_in chip for a new key', () => {
      expect(toggleAdHocFilterValue([], FilterActionType.FILTER_OUT, 'app', 'nginx')).toEqual([
        notInChip('app', ['nginx']),
      ]);
    });

    it('is idempotent for an already excluded value', () => {
      const next = toggleAdHocFilterValue([notInChip('app', ['nginx'])], FilterActionType.FILTER_OUT, 'app', 'nginx');
      expect(next).toEqual([notInChip('app', ['nginx'])]);
    });

    it('moves the value from the in chip to the not_in chip', () => {
      const next = toggleAdHocFilterValue(
        [inChip('app', ['nginx', 'apache'])],
        FilterActionType.FILTER_OUT,
        'app',
        'nginx'
      );
      expect(next).toEqual([inChip('app', ['apache']), notInChip('app', ['nginx'])]);
    });

    it('converts a legacy != chip into the not_in group together with the new value', () => {
      const legacy: AdHocFilter[] = [{ key: 'app', operator: '!=', value: 'nginx' }];
      const next = toggleAdHocFilterValue(legacy, FilterActionType.FILTER_OUT, 'app', 'apache');
      expect(next).toEqual([notInChip('app', ['nginx', 'apache'])]);
    });

    it('removes a matching level chip and excludes the value via the not_in group', () => {
      const next = toggleAdHocFilterValue([levelChip('error')], FilterActionType.FILTER_OUT, 'level', 'error');
      expect(next).toEqual([notInChip('level', ['error'])]);
    });
  });
});

describe('adHocFiltersHaveValue', () => {
  it('finds a value in an in-group chip', () => {
    expect(adHocFiltersHaveValue([inChip('app', ['nginx', 'apache'])], 'app', 'apache')).toBe(true);
  });

  it('finds the value of a legacy = chip and a level chip', () => {
    expect(adHocFiltersHaveValue([{ key: 'app', operator: '=', value: 'nginx' }], 'app', 'nginx')).toBe(true);
    expect(adHocFiltersHaveValue([levelChip('error')], 'level', 'error')).toBe(true);
  });

  it('ignores not_in chips and regex chips', () => {
    expect(adHocFiltersHaveValue([notInChip('app', ['nginx'])], 'app', 'nginx')).toBe(false);
    expect(adHocFiltersHaveValue([{ key: 'app', operator: '=~', value: 'nginx' }], 'app', 'nginx')).toBe(false);
  });

  it('returns false for a missing key or value', () => {
    expect(adHocFiltersHaveValue([inChip('app', ['nginx'])], 'env', 'dev')).toBe(false);
    expect(adHocFiltersHaveValue([inChip('app', ['nginx'])], 'app', 'apache')).toBe(false);
  });
});
