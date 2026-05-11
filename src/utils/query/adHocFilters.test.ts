import { AdHocFilter } from '../../types';

import {
  adHocFilterMatches,
  appendFilterPipeToQuery,
  formatAdHocFilterLabel,
  queryHasPipes,
  serializeAdHocFilters,
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
