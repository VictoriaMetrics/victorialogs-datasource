import { FilterActionType, StreamFilterState } from '../../types';

import { streamFiltersHaveValue, toggleStreamFilterValue } from './streamFilterToggle';

const inGroup = (label: string, values: string[]): StreamFilterState => ({ label, operator: 'in', values });
const notInGroup = (label: string, values: string[]): StreamFilterState => ({ label, operator: 'not_in', values });

describe('toggleStreamFilterValue', () => {
  describe('FILTER_FOR', () => {
    it('creates an `in` group for a new label', () => {
      expect(toggleStreamFilterValue([], FilterActionType.FILTER_FOR, 'app', 'nginx')).toEqual([
        inGroup('app', ['nginx']),
      ]);
    });

    it('merges the value into the existing `in` group of the label', () => {
      const next = toggleStreamFilterValue([inGroup('app', ['a'])], FilterActionType.FILTER_FOR, 'app', 'b');
      expect(next).toEqual([inGroup('app', ['a', 'b'])]);
    });

    it('removes the value on the second click (toggle off) and drops the empty group', () => {
      const next = toggleStreamFilterValue([inGroup('app', ['nginx'])], FilterActionType.FILTER_FOR, 'app', 'nginx');
      expect(next).toEqual([]);
    });

    it('keeps other values when toggling one off', () => {
      const next = toggleStreamFilterValue([inGroup('app', ['a', 'b'])], FilterActionType.FILTER_FOR, 'app', 'a');
      expect(next).toEqual([inGroup('app', ['b'])]);
    });

    it('removes the value from the not_in group when filtering for it', () => {
      const next = toggleStreamFilterValue([notInGroup('app', ['nginx'])], FilterActionType.FILTER_FOR, 'app', 'nginx');
      expect(next).toEqual([inGroup('app', ['nginx'])]);
    });

    it('does not touch groups of other labels', () => {
      const next = toggleStreamFilterValue([inGroup('env', ['dev'])], FilterActionType.FILTER_FOR, 'app', 'nginx');
      expect(next).toEqual([inGroup('env', ['dev']), inGroup('app', ['nginx'])]);
    });
  });

  describe('FILTER_OUT', () => {
    it('creates a `not_in` group for a new label', () => {
      expect(toggleStreamFilterValue([], FilterActionType.FILTER_OUT, 'app', 'nginx')).toEqual([
        notInGroup('app', ['nginx']),
      ]);
    });

    it('merges the value into the existing `not_in` group', () => {
      const next = toggleStreamFilterValue([notInGroup('app', ['a'])], FilterActionType.FILTER_OUT, 'app', 'b');
      expect(next).toEqual([notInGroup('app', ['a', 'b'])]);
    });

    it('does not duplicate an already excluded value', () => {
      const next = toggleStreamFilterValue([notInGroup('app', ['a'])], FilterActionType.FILTER_OUT, 'app', 'a');
      expect(next).toEqual([notInGroup('app', ['a'])]);
    });

    it('moves the value from the `in` group to the `not_in` group', () => {
      const next = toggleStreamFilterValue([inGroup('app', ['a', 'b'])], FilterActionType.FILTER_OUT, 'app', 'a');
      expect(next).toEqual([inGroup('app', ['b']), notInGroup('app', ['a'])]);
    });
  });

  it('treats a group without an operator as `in` (legacy saved state)', () => {
    const legacy = [{ label: 'app', values: ['nginx'] } as unknown as StreamFilterState];
    expect(toggleStreamFilterValue(legacy, FilterActionType.FILTER_FOR, 'app', 'nginx')).toEqual([]);
  });
});

describe('streamFiltersHaveValue', () => {
  it('finds a value in the `in` group of the label', () => {
    expect(streamFiltersHaveValue([inGroup('app', ['nginx'])], 'app', 'nginx')).toBe(true);
  });

  it('ignores `not_in` groups', () => {
    expect(streamFiltersHaveValue([notInGroup('app', ['nginx'])], 'app', 'nginx')).toBe(false);
  });

  it('returns false for a missing label or value', () => {
    expect(streamFiltersHaveValue([inGroup('app', ['nginx'])], 'env', 'dev')).toBe(false);
    expect(streamFiltersHaveValue([inGroup('app', ['nginx'])], 'app', 'apache')).toBe(false);
  });
});
