import { AdHocFilter, Query } from '../../../types';

import { buildDrawerQuery } from './drawerQuery';

const editorQuery: Query = {
  refId: 'A',
  expr: 'service:api | stats count()',
  adHocFilters: [{ key: 'old', operator: '=', value: 'x' }],
  streamFilters: [{ label: 'app', operator: 'in', values: ['web'] }],
};

const chip: AdHocFilter = { key: 'level', operator: '=', value: 'error' };

describe('buildDrawerQuery', () => {
  it('replaces the editor expression and stream filters with the drawer selection', () => {
    const result = buildDrawerQuery(editorQuery, [chip], [{ pattern: 'a', type: 'include' }]);
    expect(result).toEqual({
      refId: 'A',
      expr: '* | filter pattern_match_full("a")',
      adHocFilters: [chip],
      streamFilters: undefined,
    });
  });

  it('clears adHocFilters when the drawer has no chips', () => {
    const result = buildDrawerQuery(editorQuery, [], [{ pattern: 'b', type: 'exclude' }]);
    expect(result.adHocFilters).toBeUndefined();
    expect(result.expr).toBe('* | filter !(pattern_match_full("b"))');
  });
});
