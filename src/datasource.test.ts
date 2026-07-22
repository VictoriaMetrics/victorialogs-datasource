import { firstValueFrom, of } from 'rxjs';

import {
  AdHocVariableFilter,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  FieldType,
  LogLevel,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
} from '@grafana/data';
import * as grafanaRuntime from '@grafana/runtime';
import { TemplateSrv } from '@grafana/runtime';


// eslint-disable-next-line jest/no-mocks-import
import { createDatasource } from './__mocks__/datasource';
import { LogLevelRuleType } from './configuration/LogLevelRules/types';
import { OpenTelemetryPreset } from './configuration/OpenTelemetryPreset/types';
import { LOGS_LIMIT_DEFAULT, LOGS_LIMIT_HARD_CAP, TEXT_FILTER_ALL_VALUE, VARIABLE_ALL_VALUE } from './constants';
import { VictoriaLogsDatasource } from './datasource';
import { AdHocFilter, AdHocFiltersMode, FilterActionType, Query, QueryType, SupportingQueryType, ToggleFilterAction } from './types';

const replaceMock = jest.fn().mockImplementation((a: string) => a);

const templateSrvStub = {
  replace: replaceMock,
  getVariables: jest.fn().mockReturnValue([]),
} as unknown as TemplateSrv;

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks does not reset implementations — restore the identity default
  // so per-test mockImplementation calls don't leak into the following tests
  replaceMock.mockImplementation((a: string) => a);
});

describe('VictoriaLogsDatasource', () => {
  let ds: VictoriaLogsDatasource;

  beforeEach(() => {
    ds = createDatasource(templateSrvStub);
  });

  describe('When interpolating variables', () => {
    let customVariable: any;
    beforeEach(() => {
      customVariable = {
        id: '',
        global: false,
        multi: false,
        includeAll: false,
        allValue: null,
        query: '',
        options: [],
        current: {},
        name: '',
        type: 'custom',
        label: null,
        skipUrlSync: false,
        index: -1,
        initLock: null,
      };
    });

    it('should return a number for numeric value', () => {
      expect(ds.interpolateQueryExpr(1000 as any, customVariable)).toEqual(1000);
    });

    it('should return a value escaped by stringify for one array element', () => {
      expect(ds.interpolateQueryExpr(['arg // for &  test " this string ` end test'] as any, customVariable)).toEqual('$_StartMultiVariable_arg // for &  test " this string ` end test_EndMultiVariable');
    });
  });

  describe('applyTemplateVariables', () => {
    it('serialises a multi-value (one of) dashboard filter with its values', () => {
      const result = ds.applyTemplateVariables({ expr: '_time:5m', refId: 'A' }, {}, [
        { key: 'foo', operator: '=|', value: 'bar', values: ['bar', 'baz'] },
      ]);
      expect(result.extraFilters).toBe('foo:in("bar","baz")');
    });

    it('serialises a negated multi-value (not one of) dashboard filter with its values', () => {
      const result = ds.applyTemplateVariables({ expr: '_time:5m', refId: 'A' }, {}, [
        { key: 'foo', operator: '!=|', value: 'bar', values: ['bar', 'baz'] },
      ]);
      expect(result.extraFilters).toBe('!foo:in("bar","baz")');
    });

    it('should correctly substitute variable in expression using replace function', () => {
      const expr = '_stream:{app!~"$name"}';
      const variables = { name: 'bar' };
      replaceMock.mockImplementation(() => `_stream:{app!~"${variables.name}"}`);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe('_stream:{app!~"bar"}');
    });

    it('should retain the original query when no variables are present', () => {
      const expr = 'error';
      replaceMock.mockImplementation((input) => input);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe('error');
    });

    it('should substitute logical operators within the query', () => {
      const expr = '$severity AND _time:$time';
      const variables = { severity: 'error', time: '5m' };
      replaceMock.mockImplementation(() => `${variables.severity} AND _time:${variables.time}`);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe('error AND _time:5m');
    });

    it('should correctly replace variables within exact match functions', () => {
      const expr = 'log.level:exact("$level")';
      const variables = { level: 'error' };
      replaceMock.mockImplementation(() => `log.level:exact("${variables.level}")`);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe('log.level:exact("error")');
    });

    it('should not substitute undeclared variables', () => {
      const expr = '_stream:{app!~"$undeclaredVariable"}';
      replaceMock.mockImplementation((input) => input);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe(expr);
    });

    it('should leave the expression unchanged if the variable is not provided', () => {
      const scopedVars = {};
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables({ expr: 'foo: $var', refId: 'A' }, scopedVars);
      expect(replacedQuery.expr).toBe('foo: $var');
    });

    it('should replace $var with the string "bar" in the query', () => {
      const scopedVars = {
        var: { text: 'bar', value: 'bar' },
      };
      const templateSrvMock = {
        replace: jest.fn((a: string) => a?.replace('$var', '"bar"')),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables({ expr: 'foo: $var', refId: 'A' }, scopedVars);
      expect(replacedQuery.expr).toBe('foo: "bar"');
    });

    it('should replace $var with an | expression for stream field when given an array of values', () => {
      const scopedVars = {
        var: { text: 'foo,bar', value: ['foo', 'bar'] },
      };
      const replaceValue = `$_StartMultiVariable_${scopedVars.var.value.join('_separator_')}_EndMultiVariable`;
      const templateSrvMock = {
        replace: jest.fn((a: string) => a?.replace('$var', replaceValue)),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables({ expr: '_stream{val=~"$var"}', refId: 'A' }, scopedVars);
      expect(replacedQuery.expr).toBe('_stream{val=~"(foo|bar)"}');
    });

    it('should replace $var with an OR expression when given an array of values', () => {
      const scopedVars = {
        var: { text: 'foo,bar', value: ['foo', 'bar'] },
      };
      const templateSrvMock = {
        replace: jest.fn((a: string) => a?.replace('$var', '("foo" OR "bar")')),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables({ expr: 'foo: $var', refId: 'A' }, scopedVars);
      expect(replacedQuery.expr).toBe('foo: ("foo" OR "bar")');
    });

    it('should correctly substitute an IP address and port variable', () => {
      const scopedVars = {
        var: { text: '0.0.0.0:3000', value: '0.0.0.0:3000' },
      };
      const templateSrvMock = {
        replace: jest.fn((a: string) => a?.replace('$var', '"0.0.0.0:3000"')),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables({ expr: 'foo: $var', refId: 'A' }, scopedVars);
      expect(replacedQuery.expr).toBe('foo: "0.0.0.0:3000"');
    });

    it('should correctly substitute an array of URLs into an OR expression', () => {
      const scopedVars = {
        var: {
          text: 'http://localhost:3001/,http://192.168.50.60:3000/foo',
          value: ['http://localhost:3001/', 'http://192.168.50.60:3000/foo']
        },
      };
      const templateSrvMock = {
        replace: jest.fn((a: string) => a?.replace('$var', '("http://localhost:3001/" OR "http://192.168.50.60:3000/foo")')),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables({ expr: 'foo: $var', refId: 'A' }, scopedVars);
      expect(replacedQuery.expr).toBe('foo: ("http://localhost:3001/" OR "http://192.168.50.60:3000/foo")');
    });

    it('should replace $var with an empty string if the variable is empty', () => {
      const scopedVars = {
        var: { text: '', value: '' },
      };
      const templateSrvMock = {
        replace: jest.fn((a: string) => a?.replace('$var', '')),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables({ expr: 'foo: $var', refId: 'A' }, scopedVars);
      expect(replacedQuery.expr).toBe('foo: ');
    });

    it('should correctly substitute multiple variables within a single expression', () => {
      const scopedVars = {
        var1: { text: 'foo', value: 'foo' },
        var2: { text: 'bar', value: 'bar' },
      };
      const templateSrvMock = {
        replace: jest.fn((a: string) => a?.replace('$var1', '"foo"').replace('$var2', '"bar"')),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables({ expr: 'baz: $var1 AND qux: $var2', refId: 'A' }, scopedVars);
      expect(replacedQuery.expr).toBe('baz: "foo" AND qux: "bar"');
    });

    it('should apply ad-hoc filters to root query when adHocFiltersMode is rootQuery', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('level:="error" | _time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('should apply ad-hoc filters as extra_filters when adHocFiltersMode is extraFilters', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.ExtraFilters },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('_time:5m');
      expect(replacedQuery.extraFilters).toBe('level:="error"');
    });

    it('should not apply ad-hoc filters when adHocFiltersMode is off', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.Off },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('_time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('should apply multiple ad-hoc filters to root query when adHocFiltersMode is rootQuery', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
        { key: 'app', operator: '!=', value: 'test' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('level:="error" AND app:!="test" | _time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('should handle rootQuery mode when no ad-hoc filters are present', () => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery },
        {}
      );
      expect(replacedQuery.expr).toBe('_time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('should preserve existing adHocFilters and apply them to root query in rootQuery mode', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        {
          expr: '_time:5m',
          refId: 'A',
          adHocFilters: [{ key: 'app', operator: '=', value: 'frontend' }],
          adHocFiltersMode: AdHocFiltersMode.RootQuery,
        },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('app:="frontend" AND level:="error" | _time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('should fall back to legacy isApplyExtraFiltersToRootQuery when adHocFiltersMode is not set', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', isApplyExtraFiltersToRootQuery: true },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('level:="error" | _time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('should not apply ad-hoc filters to root query when isApplyExtraFiltersToRootQuery is false', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', isApplyExtraFiltersToRootQuery: false },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('_time:5m');
      expect(replacedQuery.extraFilters).toBe('level:="error"');
    });

    it('should apply multiple ad-hoc filters to root query when isApplyExtraFiltersToRootQuery is true', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
        { key: 'app', operator: '!=', value: 'test' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', isApplyExtraFiltersToRootQuery: true },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('level:="error" AND app:!="test" | _time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('should handle isApplyExtraFiltersToRootQuery when no ad-hoc filters are present', () => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', isApplyExtraFiltersToRootQuery: true },
        {}
      );
      expect(replacedQuery.expr).toBe('_time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('should preserve existing adHocFilters and apply them to root query when isApplyExtraFiltersToRootQuery is true', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        {
          expr: '_time:5m',
          refId: 'A',
          adHocFilters: [{ key: 'app', operator: '=', value: 'frontend' }],
          isApplyExtraFiltersToRootQuery: true,
        },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('app:="frontend" AND level:="error" | _time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('expands a marked level chip into extra_filters in extraFilters mode', () => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const adHocFilters: AdHocFilter[] = [
        { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      ];
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.ExtraFilters, adHocFilters },
        {},
      );
      expect(replacedQuery.expr).toBe('_time:5m');
      expect(replacedQuery.extraFilters).toMatch(/^\(level:contains_common_case\(.+\)\)$/);
    });

    it('expands a marked level chip into the root query in rootQuery mode', () => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const adHocFilters: AdHocFilter[] = [
        { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      ];
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery, adHocFilters },
        {},
      );
      expect(replacedQuery.expr).toMatch(/^\(level:contains_common_case\(.+\)\) \| _time:5m$/);
      expect(replacedQuery.extraFilters).toBeUndefined();
    });

    it('keeps a marked level chip in extra_filters in off mode', () => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const adHocFilters: AdHocFilter[] = [
        { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      ];
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.Off, adHocFilters },
        {},
      );
      expect(replacedQuery.expr).toBe('_time:5m');
      expect(replacedQuery.extraFilters).toMatch(/^\(level:contains_common_case\(.+\)\)$/);
    });

    it('OR-combines two marked level chips into one parenthesised group', () => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const adHocFilters: AdHocFilter[] = [
        { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
        { key: 'level', operator: '=', value: 'warning', fromLevelFilter: true },
      ];
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.ExtraFilters, adHocFilters },
        {},
      );
      expect(replacedQuery.extraFilters).toMatch(
        /^\(level:contains_common_case\(.+\) OR level:contains_common_case\(.+\)\)$/,
      );
    });

    it('expands a marked unknown-level chip into a negation', () => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const adHocFilters: AdHocFilter[] = [
        { key: 'level', operator: '=', value: LogLevel.unknown, fromLevelFilter: true },
      ];
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.ExtraFilters, adHocFilters },
        {},
      );
      // unknown = !(<all known levels OR'd>), wrapped by expandLevelChips in parens
      expect(replacedQuery.extraFilters).toMatch(/^\(!\(.+\)\)$/);
    });

  });

  describe('getExtraFilters', () => {
    it('should return undefined when no adhoc filters are provided', () => {
      const result = ds.getExtraFilters();
      expect(result).toBeUndefined();
    });

    it('should return a valid query string when adhoc filters are present', () => {
      const filters: AdHocVariableFilter[] = [
        { key: 'key1', operator: '=', value: 'value1' },
        { key: 'key2', operator: '!=', value: 'value2' },
      ];
      const result = ds.getExtraFilters(filters);
      expect(result).toBe('key1:="value1" AND key2:!="value2"');
    });
  });

  describe('interpolateVariablesInQueries', () => {
    const dashboardFilters: AdHocVariableFilter[] = [
      { key: 'level', operator: '=', value: 'error' },
    ];

    it('materialises dashboard ad-hoc filters as chips when mode is extraFilters', () => {
      const result = ds.interpolateVariablesInQueries(
        [{ expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.ExtraFilters }],
        {},
        dashboardFilters
      );
      expect(result[0].adHocFilters).toEqual(dashboardFilters);
      expect(result[0].expr).toBe('_time:5m');
      expect(result[0].extraFilters).toBeUndefined();
    });

    it('materialises dashboard ad-hoc filters as chips when no mode is set (defaults to extraFilters)', () => {
      const result = ds.interpolateVariablesInQueries(
        [{ expr: '_time:5m', refId: 'A' }],
        {},
        dashboardFilters
      );
      expect(result[0].adHocFilters).toEqual(dashboardFilters);
      expect(result[0].extraFilters).toBeUndefined();
    });

    it('inlines dashboard ad-hoc filters into expr when mode is rootQuery', () => {
      const result = ds.interpolateVariablesInQueries(
        [{ expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.RootQuery }],
        {},
        dashboardFilters
      );
      expect(result[0].expr).toBe('level:="error" | _time:5m');
      expect(result[0].adHocFilters).toBeUndefined();
      expect(result[0].extraFilters).toBeUndefined();
    });

    it('combines panel chips with dashboard ad-hoc filters into expr in rootQuery mode', () => {
      const panelChips: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'frontend' }];
      const result = ds.interpolateVariablesInQueries(
        [{
          expr: '_time:5m',
          refId: 'A',
          adHocFiltersMode: AdHocFiltersMode.RootQuery,
          adHocFilters: panelChips,
        }],
        {},
        dashboardFilters
      );
      expect(result[0].expr).toBe('app:="frontend" AND level:="error" | _time:5m');
      expect(result[0].adHocFilters).toBeUndefined();
    });

    it('drops dashboard ad-hoc filters when mode is off', () => {
      const result = ds.interpolateVariablesInQueries(
        [{ expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.Off }],
        {},
        dashboardFilters
      );
      expect(result[0].adHocFilters).toBeUndefined();
    });

    it('preserves panel-level adHocFilters even in off mode', () => {
      const panelChips: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'frontend' }];
      const result = ds.interpolateVariablesInQueries(
        [{
          expr: '_time:5m',
          refId: 'A',
          adHocFiltersMode: AdHocFiltersMode.Off,
          adHocFilters: panelChips,
        }],
        {},
        dashboardFilters
      );
      expect(result[0].adHocFilters).toEqual(panelChips);
    });

    it('honours legacy isApplyExtraFiltersToRootQuery flag (inlines into expr)', () => {
      const result = ds.interpolateVariablesInQueries(
        [{ expr: '_time:5m', refId: 'A', isApplyExtraFiltersToRootQuery: true }],
        {},
        dashboardFilters
      );
      expect(result[0].expr).toBe('level:="error" | _time:5m');
      expect(result[0].adHocFilters).toBeUndefined();
    });

    it('merges existing panel chips with dashboard ad-hoc filters', () => {
      const panelChips: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'frontend' }];
      const result = ds.interpolateVariablesInQueries(
        [{ expr: '_time:5m', refId: 'A', adHocFilters: panelChips }],
        {},
        dashboardFilters
      );
      expect(result[0].adHocFilters).toEqual([...panelChips, ...dashboardFilters]);
    });

    it('leaves adHocFilters undefined when there are no chips to materialise', () => {
      const result = ds.interpolateVariablesInQueries(
        [{ expr: '_time:5m', refId: 'A' }],
        {},
        []
      );
      expect(result[0].adHocFilters).toBeUndefined();
    });

    it('returns input unchanged when queries is empty', () => {
      expect(ds.interpolateVariablesInQueries([], {}, dashboardFilters)).toEqual([]);
    });

    it('preserves the fromLevelFilter marker on returned adHocFilters (Explore round-trip)', () => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const adHocFilters: AdHocFilter[] = [
        { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      ];
      const [out] = ds.interpolateVariablesInQueries(
        [{ expr: '_time:5m', refId: 'A', adHocFiltersMode: AdHocFiltersMode.ExtraFilters, adHocFilters }],
        {},
      );
      expect(out.adHocFilters).toEqual([
        { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
      ]);
    });
  });

  describe('interpolateString', () => {
    it('should interpolate string with all and multi values', () => {
      const scopedVars = {};
      const variables = [
        {
          name: 'var1',
          current: [{ value: 'foo' }, { value: 'bar' }],
          multi: true,
          type: 'query',
          query: {
            type: 'fieldValue'
          }
        }, {
          name: 'var2',
          current: { value: VARIABLE_ALL_VALUE },
          multi: false,
        }
      ];
      const templateSrvMock = {
        replace: jest.fn(() => 'foo: in($_StartMultiVariable_foo_separator_bar_EndMultiVariable) bar: in(*)'),
        getVariables: jest.fn().mockReturnValue(variables),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const result = ds.interpolateString('foo: $var1 bar: $var2', scopedVars);
      expect(result).toStrictEqual('foo: in(\"foo\",\"bar\") bar:in(*)');
    });

    it('does not wrap wildcard `*` of a textbox variable in double quotes inside in(...) (regression)', () => {
      const variables = [
        {
          name: 'tenant',
          current: { value: ['0'] },
          multi: true,
          type: 'query',
          query: {
            type: 'fieldValue'
          }
        },
        {
          name: 'query_hash',
          current: { value: TEXT_FILTER_ALL_VALUE },
          type: 'textbox',
          multi: false,
        }
      ];
      const templateSrvMock = {
        replace: jest.fn(() =>
          'tenant:in($_StartMultiVariable_0_EndMultiVariable) | query_hash:in($_StartMultiVariable_*_EndMultiVariable) | type:="range" | count()'
        ),
        getVariables: jest.fn().mockReturnValue(variables),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const result = ds.interpolateString(
        'tenant:in($tenant) | query_hash:$query_hash | type:="range" | count()',
        {},
      );
      expect(result).toBe('tenant:in("0") | query_hash:in(*) | type:="range" | count()');
    });
  });

  describe('max lines clamp', () => {
    describe('constructor', () => {
      it('clamps datasource maxLines to HARD_CAP when config value exceeds it', () => {
        const clamped = createDatasource(templateSrvStub, {
          jsonData: { maxLines: '50000' },
        });
        expect(clamped.maxLines).toBe(LOGS_LIMIT_HARD_CAP);
      });

      it('keeps datasource maxLines as configured when below HARD_CAP', () => {
        const ok = createDatasource(templateSrvStub, {
          jsonData: { maxLines: '500' },
        });
        expect(ok.maxLines).toBe(500);
      });

      it('falls back to default when maxLines is missing', () => {
        const def = createDatasource(templateSrvStub, { jsonData: {} });
        expect(def.maxLines).toBe(LOGS_LIMIT_DEFAULT);
      });
    });

    describe('query builder', () => {
      const buildRequest = (maxLines: number | undefined): DataQueryRequest<Query> => ({
        app: 'dashboard',
        requestId: 'r1',
        interval: '1s',
        intervalMs: 1000,
        range: {
          from: { utcOffset: () => 0 } as any,
          to: { utcOffset: () => 0 } as any,
          raw: { from: 'now-1h', to: 'now' },
        } as any,
        scopedVars: {},
        targets: [{ refId: 'A', expr: 'error', maxLines }],
        timezone: 'UTC',
        startTime: 0,
      }) as DataQueryRequest<Query>;

      it('clamps query.maxLines to HARD_CAP when it exceeds the cap', () => {
        const localDs = createDatasource(templateSrvStub, { jsonData: { maxLines: '500' } });
        const runQuerySpy = jest
          .spyOn(localDs, 'runQuery')
          .mockReturnValue({ subscribe: jest.fn() } as any);

        const req = buildRequest(50000);
        localDs.query(req);

        expect(runQuerySpy).toHaveBeenCalled();
        expect(req.targets[0].maxLines).toBe(LOGS_LIMIT_HARD_CAP);
        runQuerySpy.mockRestore();
      });

      it('keeps query.maxLines as-is when below HARD_CAP', () => {
        const localDs = createDatasource(templateSrvStub, { jsonData: { maxLines: '500' } });
        const runQuerySpy = jest
          .spyOn(localDs, 'runQuery')
          .mockReturnValue({ subscribe: jest.fn() } as any);

        const req = buildRequest(800);
        localDs.query(req);

        expect(req.targets[0].maxLines).toBe(800);
        runQuerySpy.mockRestore();
      });

      it('uses datasource.maxLines when query.maxLines is undefined', () => {
        const localDs = createDatasource(templateSrvStub, { jsonData: { maxLines: '2000' } });
        const runQuerySpy = jest
          .spyOn(localDs, 'runQuery')
          .mockReturnValue({ subscribe: jest.fn() } as any);

        const req = buildRequest(undefined);
        localDs.query(req);

        expect(req.targets[0].maxLines).toBe(2000);
        runQuerySpy.mockRestore();
      });
    });
  });

  describe('toggleQueryFilter', () => {
    const makeFilter = (
      type: FilterActionType,
      key = 'level',
      value = 'error',
    ): ToggleFilterAction => ({ type, options: { key, value } });

    it('adds FILTER_FOR into adHocFilters when adHocFilters is empty', () => {
      const query: Query = { refId: 'A', expr: '_time:5m' };
      const result = ds.toggleQueryFilter(query, makeFilter(FilterActionType.FILTER_FOR));
      expect(result.adHocFilters).toEqual([{ key: 'level', operator: '=', value: 'error' }]);
      expect(result.expr).toBe('_time:5m');
    });

    it('adds FILTER_OUT with != operator', () => {
      const query: Query = { refId: 'A', expr: '' };
      const result = ds.toggleQueryFilter(query, makeFilter(FilterActionType.FILTER_OUT));
      expect(result.adHocFilters).toEqual([{ key: 'level', operator: '!=', value: 'error' }]);
      expect(result.expr).toBe('*');
    });

    it('appends to existing adHocFilters', () => {
      const query: Query = {
        refId: 'A',
        expr: '*',
        adHocFilters: [{ key: 'app', operator: '=', value: 'api' }],
      };
      const result = ds.toggleQueryFilter(query, makeFilter(FilterActionType.FILTER_FOR));
      expect(result.adHocFilters).toEqual([
        { key: 'app', operator: '=', value: 'api' },
        { key: 'level', operator: '=', value: 'error' },
      ]);
      expect(result.expr).toBe('*');
    });

    it('toggles off existing FILTER_FOR (second click removes it)', () => {
      const query: Query = {
        refId: 'A',
        expr: '*',
        adHocFilters: [{ key: 'level', operator: '=', value: 'error' }],
      };
      const result = ds.toggleQueryFilter(query, makeFilter(FilterActionType.FILTER_FOR));
      expect(result.adHocFilters).toBeUndefined();
      expect(result.expr).toBe('*');
    });

    it('does not modify expr even when the same filter is already in expr', () => {
      const query: Query = { refId: 'A', expr: 'level:="error"' };
      const result = ds.toggleQueryFilter(query, makeFilter(FilterActionType.FILTER_FOR));
      expect(result.expr).toBe('level:="error"');
      expect(result.adHocFilters).toEqual([{ key: 'level', operator: '=', value: 'error' }]);
    });

    it('returns query unchanged when key or value is missing', () => {
      const query: Query = { refId: 'A', expr: '*' };
      const result = ds.toggleQueryFilter(query, {
        type: FilterActionType.FILTER_FOR,
        options: { key: '', value: '' },
      });
      expect(result).toEqual(query);
    });

    it('preserves keys with colons in adHocFilters as-is', () => {
      const query: Query = { refId: 'A', expr: '' };
      const result = ds.toggleQueryFilter(
        query,
        makeFilter(FilterActionType.FILTER_FOR, 'span:attr_id', '123'),
      );
      expect(result.adHocFilters).toEqual([
        { key: 'span:attr_id', operator: '=', value: '123' },
      ]);
    });
  });
});

function settingsWithPreset(preset: OpenTelemetryPreset): Partial<DataSourceInstanceSettings<any>> {
  return {
    id: 1,
    uid: 'u',
    jsonData: {
      otelPreset: preset,
    },
  };
}

describe('VictoriaLogsDatasource preset merge', () => {
  it('does not add preset entries when otelPreset is absent', () => {
    const ds = createDatasource(templateSrvStub);
    expect(ds.derivedFields).toEqual([]);
    expect(ds.logLevelRules).toEqual([]);
  });

  it('does not add preset entries when enabled is false', () => {
    const ds = createDatasource(templateSrvStub, settingsWithPreset({
      enabled: false,
      detection: {
        traceIdField: 'trace_id',
      },
    }));
    expect(ds.derivedFields).toEqual([]);
    expect(ds.logLevelRules).toEqual([]);
  });

  it('does not add preset entries when detection snapshot is missing', () => {
    const ds = createDatasource(templateSrvStub, settingsWithPreset({
      enabled: true,
    }));
    expect(ds.derivedFields).toEqual([]);
    expect(ds.logLevelRules).toEqual([]);
  });

  it('merges preset derived fields when enabled with detection', () => {
    const ds = createDatasource(templateSrvStub, settingsWithPreset({
      enabled: true,
      tracesDatasourceUid: 'tempo-uid',
      detection: {
        traceIdField: 'trace_id',
      },
    }));
    expect(ds.derivedFields.map(f => f.name)).toEqual(['trace_id']);
    expect(ds.derivedFields.every(f => f.datasourceUid === 'tempo-uid')).toBe(true);
  });

  it('user derivedField with same name overrides preset entry', () => {
    const userField = {
      name: 'trace_id',
      matcherRegex: 'user-regex',
      matcherType: 'regex' as const,
      datasourceUid: 'user-uid',
      url: '',
    };
    const ds = createDatasource(templateSrvStub, {
      id: 1,
      uid: 'u',
      jsonData: {
        derivedFields: [userField],
        otelPreset: {
          enabled: true,
          tracesDatasourceUid: 'tempo-uid',
          detection: {
            traceIdField: 'trace_id',
          },
        },
      },
    });
    const traceFields = ds.derivedFields.filter(f => f.name === 'trace_id');
    expect(traceFields).toHaveLength(1);
    expect(traceFields[0].matcherRegex).toBe('user-regex');
  });

  it('merges preset log level rules when severity detection is present', () => {
    const ds = createDatasource(templateSrvStub, settingsWithPreset({
      enabled: true,
      detection: {
        traceIdField: 'trace_id',
        severity: {
          field: 'severity_text',
          valueCase: 'string',
          source: 'auto',
        },
      },
    }));
    expect(ds.logLevelRules).toHaveLength(18);
    expect(ds.logLevelRules.every(r => r.field === 'severity_text')).toBe(true);
  });

  it('user rule with same field|operator|value overrides preset rule', () => {
    const userRule = {
      field: 'severity_text',
      operator: LogLevelRuleType.Equals,
      value: 'ERROR',
      level: LogLevel.critical,
      enabled: true,
    };
    const ds = createDatasource(templateSrvStub, {
      id: 1,
      uid: 'u',
      jsonData: {
        logLevelRules: [userRule],
        otelPreset: {
          enabled: true,
          detection: {
            traceIdField: 'trace_id',
            severity: {
              field: 'severity_text',
              valueCase: 'string',
              source: 'auto',
            },
          },
        },
      },
    });
    expect(ds.logLevelRules).toHaveLength(19);
    const errorRules = ds.logLevelRules.filter(r => r.value === 'ERROR');
    expect(errorRules).toHaveLength(1);
    expect(errorRules[0].level).toBe(LogLevel.critical);
  });

  describe('getSupplementaryQuery', () => {
    let ds: VictoriaLogsDatasource;

    beforeEach(() => {
      ds = createDatasource(templateSrvStub);
    });

    const makeRequest = (): DataQueryRequest<Query> => ({
      app: 'explore',
      requestId: 'r1',
      interval: '1s',
      intervalMs: 1000,
      range: {
        from: { utcOffset: () => 0, diff: () => 3600 } as any,
        to: { utcOffset: () => 0, diff: () => 3600 } as any,
        raw: { from: 'now-1h', to: 'now' },
      } as any,
      scopedVars: {},
      targets: [],
      timezone: 'UTC',
      startTime: 0,
    }) as DataQueryRequest<Query>;

    const makeQuery = (queryType: QueryType, overrides: Partial<Query> = {}): Query => ({
      refId: 'A',
      expr: '*',
      queryType,
      ...overrides,
    });

    describe('LogsVolume', () => {
      const opts: SupplementaryQueryOptions = { type: SupplementaryQueryType.LogsVolume };

      it('returns a Hits supplementary query for Raw Logs (Instant) queryType', () => {
        const result = ds.getSupplementaryQuery(opts, makeQuery(QueryType.Instant), makeRequest());
        expect(result).toBeDefined();
        expect(result?.queryType).toBe(QueryType.Hits);
        expect(result?.supportingQueryType).toBe(SupportingQueryType.LogsVolume);
        expect(result?.refId).toBe('log-volume-A');
      });

      it.each([
        ['StatsRange (Range UI)', QueryType.StatsRange],
        ['Stats (Instant UI)', QueryType.Stats],
        ['Hits (internal)', QueryType.Hits],
      ])('returns undefined for %s — fix #630', (_label, queryType) => {
        const result = ds.getSupplementaryQuery(opts, makeQuery(queryType), makeRequest());
        expect(result).toBeUndefined();
      });

      it('returns undefined when the query is hidden', () => {
        const result = ds.getSupplementaryQuery(
          opts,
          makeQuery(QueryType.Instant, { hide: true }),
          makeRequest(),
        );
        expect(result).toBeUndefined();
      });

    });

    describe('LogsSample', () => {
      const opts: SupplementaryQueryOptions = { type: SupplementaryQueryType.LogsSample };

      it.each([
        ['StatsRange (Range UI)', QueryType.StatsRange],
        ['Stats (Instant UI)', QueryType.Stats],
      ])('returns an Instant supplementary query for %s', (_label, queryType) => {
        const result = ds.getSupplementaryQuery(opts, makeQuery(queryType), makeRequest());
        expect(result).toBeDefined();
        expect(result?.queryType).toBe(QueryType.Instant);
        expect(result?.supportingQueryType).toBe(SupportingQueryType.LogsSample);
        expect(result?.refId).toBe('log-sample-A');
      });

      it.each([
        ['Instant (Raw Logs UI)', QueryType.Instant],
        ['Hits (internal)', QueryType.Hits],
      ])('returns undefined for %s — would duplicate the main request', (_label, queryType) => {
        const result = ds.getSupplementaryQuery(opts, makeQuery(queryType), makeRequest());
        expect(result).toBeUndefined();
      });
    });
  });

  describe('getTagKeys / getTagValues narrow-down', () => {
    let dsLocal: VictoriaLogsDatasource;
    let getFieldList: jest.Mock;

    beforeEach(() => {
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      dsLocal = createDatasource(templateSrvMock);
      getFieldList = jest.fn().mockResolvedValue([{ value: 'foo' }]);
      dsLocal.languageProvider = { getFieldList } as any;
    });

    it('getTagKeys without filters sends no narrowing query', async () => {
      await dsLocal.getTagKeys({ filters: [] });
      expect(getFieldList.mock.calls[0][0].query).toBeUndefined();
    });

    it('getTagKeys with one filter builds LogsQL query', async () => {
      const filters: AdHocVariableFilter[] = [{ key: 'level', operator: '=', value: 'error' }];
      await dsLocal.getTagKeys({ filters });
      expect(getFieldList.mock.calls[0][0].query).toBe('level:="error"');
    });

    it('getTagKeys with two filters joins them with AND', async () => {
      const filters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
        { key: 'app', operator: '=', value: 'api' },
      ];
      await dsLocal.getTagKeys({ filters });
      expect(getFieldList.mock.calls[0][0].query).toBe('level:="error" AND app:="api"');
    });

    it('getTagValues excludes filters on the queried key', async () => {
      const filters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
        { key: 'app', operator: '=', value: 'api' },
      ];
      await dsLocal.getTagValues({ key: 'level', filters });
      const opts = getFieldList.mock.calls[0][0];
      expect(opts.field).toBe('level');
      expect(opts.query).toBe('app:="api"');
    });

    it('getTagValues narrows by other-key filters', async () => {
      const filters: AdHocVariableFilter[] = [{ key: 'level', operator: '=', value: 'error' }];
      await dsLocal.getTagValues({ key: 'app', filters });
      const opts = getFieldList.mock.calls[0][0];
      expect(opts.field).toBe('app');
      expect(opts.query).toBe('level:="error"');
    });

    it('getTagValues with only same-key filter sends no narrowing query', async () => {
      const filters: AdHocVariableFilter[] = [{ key: 'level', operator: '=', value: 'error' }];
      await dsLocal.getTagValues({ key: 'level', filters });
      expect(getFieldList.mock.calls[0][0].query).toBeUndefined();
    });

    it('getTagKeys resolves a variable in the filter value', async () => {
      const templateSrvMock = {
        replace: jest.fn(() => 'env:="prod"'),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds2 = createDatasource(templateSrvMock);
      const gfl = jest.fn().mockResolvedValue([]);
      ds2.languageProvider = { getFieldList: gfl } as any;
      const filters: AdHocVariableFilter[] = [{ key: 'env', operator: '=', value: '$env' }];
      await ds2.getTagKeys({ filters });
      expect(gfl.mock.calls[0][0].query).toBe('env:="prod"');
    });

    it('getTagKeys builds regex operator filter', async () => {
      const filters: AdHocVariableFilter[] = [{ key: 'app', operator: '=~', value: 'api.*' }];
      await dsLocal.getTagKeys({ filters });
      expect(getFieldList.mock.calls[0][0].query).toBe('app:~"api.*"');
    });
  });
});

describe('VictoriaLogsDatasource live streaming', () => {
  const buildStreamFrame = (): DataFrame => ({
    refId: 'A',
    length: 1,
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: [0] },
      { name: 'Line', type: FieldType.string, config: {}, values: ['msg'] },
      { name: 'labels', type: FieldType.other, config: {}, values: [{ app: 'nginx' }] },
    ],
  });

  const makeLiveRequest = (query: Partial<Query>): DataQueryRequest<Query> => ({
    app: 'explore',
    requestId: 'r1',
    interval: '1s',
    intervalMs: 1000,
    liveStreaming: true,
    range: {
      from: { utcOffset: () => 0, diff: () => 3600 } as any,
      to: { utcOffset: () => 0, diff: () => 3600 } as any,
      raw: { from: 'now-1h', to: 'now' },
    } as any,
    scopedVars: {},
    targets: [{ refId: 'A', expr: '*', queryType: QueryType.Instant, ...query } as Query],
    timezone: 'UTC',
    startTime: 0,
  }) as DataQueryRequest<Query>;

  const runLiveQuery = async (query: Partial<Query>): Promise<DataQueryResponse> => {
    jest.spyOn(grafanaRuntime, 'getGrafanaLiveSrv').mockReturnValue({
      getDataStream: jest.fn().mockReturnValue(of({ data: [buildStreamFrame()] })),
    } as unknown as ReturnType<typeof grafanaRuntime.getGrafanaLiveSrv>);

    const ds = createDatasource();
    return firstValueFrom(ds.query(makeLiveRequest(query)));
  };

  it('packs labels into the Line field when packJson is enabled', async () => {
    const response = await runLiveQuery({ packJson: true });

    const lineField = (response.data[0] as DataFrame).fields.find((f) => f.name === 'Line');
    expect(lineField?.values[0]).toBe('{"_msg":"msg","app":"nginx"}');
  });

  it('keeps the Line field untouched when packJson is disabled', async () => {
    const response = await runLiveQuery({});

    const lineField = (response.data[0] as DataFrame).fields.find((f) => f.name === 'Line');
    expect(lineField?.values[0]).toBe('msg');
  });
});
