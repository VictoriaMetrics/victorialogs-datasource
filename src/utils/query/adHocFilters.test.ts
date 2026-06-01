import { AdHocVariableFilter } from '@grafana/data';

import { AdHocFilter, AdHocFiltersMode } from '../../types';

import {
  adHocFilterMatches,
  appendFilterPipeToQuery,
  expandLevelChips,
  formatAdHocFilterLabel,
  queryHasPipes,
  resolveAdHocFilters,
  resolveAdHocFiltersMode,
  serializeAdHocFilters,
  serializeChipsForBackend,
} from './adHocFilters';

describe('serializeAdHocFilters', () => {
  it('returns undefined for empty / missing input', () => {
    expect(serializeAdHocFilters(undefined)).toBeUndefined();
    expect(serializeAdHocFilters([])).toBeUndefined();
  });

  it('serializes a single equality filter', () => {
    const filters: AdHocFilter[] = [{ key: 'service', operator: '=', value: 'api' }];
    expect(serializeAdHocFilters(filters)).toBe('service:="api"');
  });

  it('joins multiple filters with AND', () => {
    const filters: AdHocFilter[] = [
      { key: 'service', operator: '=', value: 'api' },
      { key: 'level', operator: '!=', value: 'debug' },
    ];
    expect(serializeAdHocFilters(filters)).toBe('service:="api" AND level:!="debug"');
  });

  it('quotes keys that contain a colon', () => {
    const filters: AdHocFilter[] = [{ key: 'foo:bar', operator: '=', value: 'baz' }];
    expect(serializeAdHocFilters(filters)).toBe('"foo:bar":="baz"');
  });

  it('uses :in(...) for multi-value =| operator', () => {
    const filters: AdHocFilter[] = [
      { key: 'level', operator: '=|', value: '', values: ['info', 'warn'] },
    ];
    expect(serializeAdHocFilters(filters)).toBe('level:in("info","warn")');
  });

  it('uses !key:in(...) for multi-value !=| operator', () => {
    const filters: AdHocFilter[] = [
      { key: 'level', operator: '!=|', value: '', values: ['info', 'warn'] },
    ];
    expect(serializeAdHocFilters(filters)).toBe('!level:in("info","warn")');
  });

  it('serializes _stream NOT filter with parentheses', () => {
    const filters: AdHocFilter[] = [{ key: '_stream', operator: '!=', value: 'prod' }];
    expect(serializeAdHocFilters(filters)).toBe('(! _stream: prod)');
  });

  it('serializes _stream equality without parentheses', () => {
    const filters: AdHocFilter[] = [{ key: '_stream', operator: '=', value: 'prod' }];
    expect(serializeAdHocFilters(filters)).toBe('_stream:prod');
  });
});

describe('formatAdHocFilterLabel', () => {
  it('returns the same shape as a single serialized filter', () => {
    const f: AdHocFilter = { key: 'service', operator: '=', value: 'api' };
    expect(formatAdHocFilterLabel(f)).toBe('service:="api"');
  });
});

describe('queryHasPipes', () => {
  it('is false for empty / whitespace', () => {
    expect(queryHasPipes('')).toBe(false);
    expect(queryHasPipes('   ')).toBe(false);
  });

  it('is false for `*` (no upstream to filter)', () => {
    expect(queryHasPipes('*')).toBe(false);
  });

  it('is false for a filter expression without pipes', () => {
    expect(queryHasPipes('service:="api"')).toBe(false);
    expect(queryHasPipes('service:="api" AND level:="info"')).toBe(false);
  });

  it('is true when at least one top-level pipe is present', () => {
    expect(queryHasPipes('* | stats count()')).toBe(true);
    expect(queryHasPipes('service:="api" | extract "<u>" as user')).toBe(true);
  });

  it('ignores pipes inside quoted strings or braces', () => {
    expect(queryHasPipes('{app="a|b"}')).toBe(false);
    expect(queryHasPipes('msg:~"a|b"')).toBe(false);
  });
});

describe('appendFilterPipeToQuery', () => {
  const eqFilter: AdHocFilter = { key: 'user', operator: '=', value: 'alice' };

  it('returns just the filter when expr is empty', () => {
    expect(appendFilterPipeToQuery('', eqFilter)).toBe('user:="alice"');
  });

  it('returns just the filter when expr is `*`', () => {
    expect(appendFilterPipeToQuery('*', eqFilter)).toBe('user:="alice"');
  });

  it('falls back to addLabelToQuery when expr has no pipes', () => {
    expect(appendFilterPipeToQuery('service:="api"', eqFilter)).toBe(
      'service:="api" AND user:="alice"',
    );
  });

  it('appends as `| filter ...` when expr has at least one pipe', () => {
    expect(
      appendFilterPipeToQuery('* | extract "<u>" as user', eqFilter),
    ).toBe('* | extract "<u>" as user | filter user:="alice"');
  });

  it('appends at the very end, after multiple pipes', () => {
    expect(
      appendFilterPipeToQuery(
        '* | extract "<u>" as user | sort by (_time) desc',
        eqFilter,
      ),
    ).toBe('* | extract "<u>" as user | sort by (_time) desc | filter user:="alice"');
  });

  it('preserves the operator (!=) in the appended pipe', () => {
    const f: AdHocFilter = { key: 'user', operator: '!=', value: 'alice' };
    expect(appendFilterPipeToQuery('* | extract "<u>" as user', f)).toBe(
      '* | extract "<u>" as user | filter user:!="alice"',
    );
  });

  it('preserves the regex operator (=~) in the appended pipe', () => {
    const f: AdHocFilter = { key: 'user', operator: '=~', value: 'al.*' };
    expect(appendFilterPipeToQuery('* | extract "<u>" as user', f)).toBe(
      '* | extract "<u>" as user | filter user:~"al.*"',
    );
  });

  it('preserves the multi-value operator (=|) in the appended pipe', () => {
    const f: AdHocFilter = {
      key: 'user',
      operator: '=|',
      value: '',
      values: ['alice', 'bob'],
    };
    expect(appendFilterPipeToQuery('* | extract "<u>" as user', f)).toBe(
      '* | extract "<u>" as user | filter user:in("alice","bob")',
    );
  });

  it('trims trailing whitespace before appending', () => {
    expect(
      appendFilterPipeToQuery('*  |  extract "<u>" as user   ', eqFilter),
    ).toBe('*  |  extract "<u>" as user | filter user:="alice"');
  });
});

describe('adHocFilterMatches', () => {
  const f: AdHocFilter = { key: 'service', operator: '=', value: 'api' };

  it('matches by exact key and value', () => {
    expect(adHocFilterMatches(f, 'service', 'api')).toBe(true);
  });

  it('does not match different key', () => {
    expect(adHocFilterMatches(f, 'level', 'api')).toBe(false);
  });

  it('does not match different value', () => {
    expect(adHocFilterMatches(f, 'service', 'web')).toBe(false);
  });
});

describe('serializeChipsForBackend', () => {
  it('returns undefined for undefined input', () => {
    expect(serializeChipsForBackend(undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(serializeChipsForBackend([])).toBeUndefined();
  });

  it('serialises a single chip into a LogsQL filter', () => {
    const chips: AdHocFilter[] = [{ key: 'level', operator: '=', value: 'error' }];
    expect(serializeChipsForBackend(chips)).toBe('level:="error"');
  });

  it('joins multiple chips with AND', () => {
    const chips: AdHocFilter[] = [
      { key: 'level', operator: '=', value: 'error' },
      { key: 'app', operator: '!=', value: 'test' },
    ];
    expect(serializeChipsForBackend(chips)).toBe('level:="error" AND app:!="test"');
  });

  it('restores placeholder variables via returnVariables', () => {
    // returnVariables turns the internal `__V_0__name__V__` placeholder back into `$name`
    const chips: AdHocFilter[] = [{ key: 'level', operator: '=', value: '__V_0__severity__V__' }];
    expect(serializeChipsForBackend(chips)).toBe('level:="$severity"');
  });
});

describe('resolveAdHocFiltersMode', () => {
  it('returns AdHocFiltersMode.Off when set explicitly', () => {
    expect(resolveAdHocFiltersMode({ expr: '', refId: 'A', adHocFiltersMode: AdHocFiltersMode.Off })).toBe(AdHocFiltersMode.Off);
  });

  it('returns AdHocFiltersMode.RootQuery when set explicitly', () => {
    expect(resolveAdHocFiltersMode({ expr: '', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery })).toBe(AdHocFiltersMode.RootQuery);
  });

  it('returns AdHocFiltersMode.ExtraFilters when set explicitly', () => {
    expect(resolveAdHocFiltersMode({ expr: '', refId: 'A', adHocFiltersMode: AdHocFiltersMode.ExtraFilters })).toBe(AdHocFiltersMode.ExtraFilters);
  });

  it('falls back to legacy isApplyExtraFiltersToRootQuery=true → RootQuery', () => {
    expect(resolveAdHocFiltersMode({ expr: '', refId: 'A', isApplyExtraFiltersToRootQuery: true })).toBe(AdHocFiltersMode.RootQuery);
  });

  it('falls back to legacy isApplyExtraFiltersToRootQuery=false → ExtraFilters', () => {
    expect(resolveAdHocFiltersMode({ expr: '', refId: 'A', isApplyExtraFiltersToRootQuery: false })).toBe(AdHocFiltersMode.ExtraFilters);
  });

  it('defaults to ExtraFilters when neither flag is set', () => {
    expect(resolveAdHocFiltersMode({ expr: '', refId: 'A' })).toBe(AdHocFiltersMode.ExtraFilters);
  });
});

describe('resolveAdHocFilters', () => {
  const dashboard: AdHocVariableFilter[] = [{ key: 'level', operator: '=', value: 'error' }];

  describe('mode Off', () => {
    it('returns interpolated expr untouched and preserves panel chips', () => {
      const panelChips: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'frontend' }];
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.Off, adHocFilters: panelChips },
        '_time:5m',
        dashboard
      );
      expect(result).toEqual({ expr: '_time:5m', chips: panelChips });
    });

    it('drops dashboard filters', () => {
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.Off },
        '_time:5m',
        dashboard
      );
      expect(result.chips).toBeUndefined();
    });
  });

  describe('mode RootQuery', () => {
    it('prefixes dashboard filters to expr', () => {
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery },
        '_time:5m',
        dashboard
      );
      expect(result).toEqual({ expr: 'level:="error" | _time:5m', chips: undefined });
    });

    it('combines panel chips with dashboard filters, panel first', () => {
      const panelChips: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'frontend' }];
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery, adHocFilters: panelChips },
        '_time:5m',
        dashboard
      );
      expect(result.expr).toBe('app:="frontend" AND level:="error" | _time:5m');
      expect(result.chips).toBeUndefined();
    });

    it('leaves expr unchanged when there are no chips to prepend', () => {
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery },
        '_time:5m',
        []
      );
      expect(result).toEqual({ expr: '_time:5m', chips: undefined });
    });
  });

  describe('mode ExtraFilters (and default)', () => {
    it('materialises dashboard filters into chips', () => {
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.ExtraFilters },
        '_time:5m',
        dashboard
      );
      expect(result.expr).toBe('_time:5m');
      expect(result.chips).toEqual([{ key: 'level', operator: '=', value: 'error' }]);
    });

    it('behaves like ExtraFilters when mode is unset (default)', () => {
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A' },
        '_time:5m',
        dashboard
      );
      expect(result.chips).toEqual([{ key: 'level', operator: '=', value: 'error' }]);
    });

    it('combines panel chips with dashboard filters, panel first', () => {
      const panelChips: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'frontend' }];
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A', adHocFilters: panelChips },
        '_time:5m',
        dashboard
      );
      expect(result.chips).toEqual([
        { key: 'app', operator: '=', value: 'frontend' },
        { key: 'level', operator: '=', value: 'error' },
      ]);
    });

    it('returns chips=undefined when nothing to materialise', () => {
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A' },
        '_time:5m',
        []
      );
      expect(result.chips).toBeUndefined();
    });
  });

  describe('legacy flag', () => {
    it('isApplyExtraFiltersToRootQuery=true behaves as RootQuery', () => {
      const result = resolveAdHocFilters(
        { expr: '_time:5m', refId: 'A', isApplyExtraFiltersToRootQuery: true },
        '_time:5m',
        dashboard
      );
      expect(result.expr).toBe('level:="error" | _time:5m');
      expect(result.chips).toBeUndefined();
    });
  });
});

describe('expandLevelChips', () => {
  it('leaves chips untouched when none are marked', () => {
    const chips: AdHocFilter[] = [{ key: 'level', operator: '=', value: 'error' }];
    const { levelExpr, rest } = expandLevelChips(chips, []);
    expect(levelExpr).toBeUndefined();
    expect(rest).toEqual(chips);
  });

  it('expands a single marked level chip, wrapped in parens', () => {
    const chips: AdHocFilter[] = [{ key: 'level', operator: '=', value: 'error', fromLevelFilter: true }];
    const { levelExpr, rest } = expandLevelChips(chips, []);
    expect(rest).toEqual([]);
    expect(levelExpr).toMatch(/^\(level:contains_common_case\(.+\)\)$/);
  });

  it('OR-combines multiple marked level chips inside one paren group', () => {
    const chips: AdHocFilter[] = [
      { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      { key: 'level', operator: '=', value: 'warning', fromLevelFilter: true },
    ];
    const { levelExpr, rest } = expandLevelChips(chips, []);
    expect(rest).toEqual([]);
    expect(levelExpr).toMatch(/^\(level:contains_common_case\(.+\) OR level:contains_common_case\(.+\)\)$/);
  });

  it('keeps non-level chips in rest', () => {
    const chips: AdHocFilter[] = [
      { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      { key: 'service', operator: '=', value: 'api' },
    ];
    const { levelExpr, rest } = expandLevelChips(chips, []);
    expect(levelExpr).toMatch(/^\(level:contains_common_case\(.+\)\)$/);
    expect(rest).toEqual([{ key: 'service', operator: '=', value: 'api' }]);
  });

  it('keeps a marked chip with an unknown level value in rest (defensive)', () => {
    const chips: AdHocFilter[] = [{ key: 'level', operator: '=', value: 'bogus', fromLevelFilter: true }];
    const { levelExpr, rest } = expandLevelChips(chips, []);
    expect(levelExpr).toBeUndefined();
    expect(rest).toEqual([{ key: 'level', operator: '=', value: 'bogus', fromLevelFilter: true }]);
  });
});

describe('serializeChipsForBackend with level rules', () => {
  it('AND-combines an expanded level group with other chips', () => {
    const chips: AdHocFilter[] = [
      { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      { key: 'service', operator: '=', value: 'api' },
    ];
    const result = serializeChipsForBackend(chips, []);
    expect(result).toMatch(/^\(level:contains_common_case\(.+\)\) AND service:="api"$/);
  });

  it('leaves unmarked level chips literal even when rules are passed', () => {
    const chips: AdHocFilter[] = [{ key: 'level', operator: '=', value: 'error' }];
    expect(serializeChipsForBackend(chips, [])).toBe('level:="error"');
  });
});
