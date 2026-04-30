import {
  AdHocVariableFilter,
  DataQueryRequest,
  DataSourceInstanceSettings,
  LogLevel,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
} from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

// eslint-disable-next-line jest/no-mocks-import
import { createDatasource } from './__mocks__/datasource';
import { LogLevelRuleType } from './configuration/LogLevelRules/types';
import { OpenTelemetryPreset } from './configuration/OpenTelemetryPreset/types';
import { LOGS_LIMIT_HARD_CAP, VARIABLE_ALL_VALUE } from './constants';
import { VictoriaLogsDatasource } from './datasource';
import { Query, QueryType, SupportingQueryType } from './types';

const replaceMock = jest.fn().mockImplementation((a: string) => a);

const templateSrvStub = {
  replace: replaceMock,
  getVariables: jest.fn().mockReturnValue([]),
} as unknown as TemplateSrv;

beforeEach(() => {
  jest.clearAllMocks();
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

    it('should apply ad-hoc filters to root query when isApplyExtraFiltersToRootQuery is true', () => {
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

    it('should preserve existing extraFilters and apply them to root query when isApplyExtraFiltersToRootQuery is true', () => {
      const adhocFilters: AdHocVariableFilter[] = [
        { key: 'level', operator: '=', value: 'error' },
      ];
      const templateSrvMock = {
        replace: jest.fn((a: string) => a),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_time:5m', refId: 'A', extraFilters: 'app:="frontend"', isApplyExtraFiltersToRootQuery: true },
        {},
        adhocFilters
      );
      expect(replacedQuery.expr).toBe('app:="frontend" AND level:="error" | _time:5m');
      expect(replacedQuery.extraFilters).toBeUndefined();
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

      it('falls back to default 1000 when maxLines is missing', () => {
        const def = createDatasource(templateSrvStub, { jsonData: {} });
        expect(def.maxLines).toBe(1000);
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
});
