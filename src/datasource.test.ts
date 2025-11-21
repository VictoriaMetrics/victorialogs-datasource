import { AdHocVariableFilter } from '@grafana/data';
import { TemplateSrv } from "@grafana/runtime";

import { createDatasource } from "./__mocks__/datasource";
import { TEXT_FILTER_ALL_VALUE, VARIABLE_ALL_VALUE } from "./constants";
import { VictoriaLogsDatasource } from "./datasource";

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
      expect(ds.interpolateQueryExpr(['arg // for &  test " this string ` end test'] as any, customVariable)).toEqual("$_StartMultiVariable_arg // for &  test \" this string ` end test_EndMultiVariable");
    });
  });

  describe('applyTemplateVariables', () => {
    it('should correctly substitute variable in expression using replace function', () => {
      const expr = '_stream:{app!~"$name"}';
      const variables = { name: 'bar' };
      replaceMock.mockImplementation(() => `_stream:{app!~"${variables.name}"}`);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe(`_stream:{app!~"bar"}`);
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
      const replacedQuery = ds.applyTemplateVariables(
        { expr: 'foo: $var', refId: 'A' },
        scopedVars
      );
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
      const replacedQuery = ds.applyTemplateVariables(
        { expr: 'foo: $var', refId: 'A' },
        scopedVars
      );
      expect(replacedQuery.expr).toBe('foo: "bar"');
    });

    it('should replace $var with an | expression for stream field when given an array of values', () => {
      const scopedVars = {
        var: { text: 'foo,bar', value: ['foo', 'bar'] },
      };
      const replaceValue = `$_StartMultiVariable_${scopedVars.var.value.join("_separator_")}_EndMultiVariable`
      const templateSrvMock = {
        replace: jest.fn((a: string) => a?.replace('$var', replaceValue)),
        getVariables: jest.fn().mockReturnValue([]),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const replacedQuery = ds.applyTemplateVariables(
        { expr: '_stream{val=~"$var"}', refId: 'A' },
        scopedVars
      );
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
      const replacedQuery = ds.applyTemplateVariables(
        { expr: 'foo: $var', refId: 'A' },
        scopedVars
      );
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
      const replacedQuery = ds.applyTemplateVariables(
        { expr: 'foo: $var', refId: 'A' },
        scopedVars
      );
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
      const replacedQuery = ds.applyTemplateVariables(
        { expr: 'foo: $var', refId: 'A' },
        scopedVars
      );
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
      const replacedQuery = ds.applyTemplateVariables(
        { expr: 'foo: $var', refId: 'A' },
        scopedVars
      );
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
      const replacedQuery = ds.applyTemplateVariables(
        { expr: 'baz: $var1 AND qux: $var2', refId: 'A' },
        scopedVars
      );
      expect(replacedQuery.expr).toBe('baz: "foo" AND qux: "bar"');
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
          current: [{ value: "foo" }, { value: "bar" }],
          multi: true,
          type: "query",
          query: {
            type: "fieldValue"
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
      expect(result).toStrictEqual('foo: in(\"foo\",\"bar\") bar: in(*)');
    })

    it('should not escape the * in the text filter ', () => {
      const scopedVars = {};
      const variables = [
        {
          name: 'var1',
          current: [{ value: "foo" }, { value: "bar" }],
          multi: true,
          type: "query",
          query: {
            type: "fieldValue"
          }
        }, {
          name: 'var2',
          current: { value: VARIABLE_ALL_VALUE },
          multi: false,
        },
        {
          name: 'var3',
          current: { value: TEXT_FILTER_ALL_VALUE },
          multi: false,
        }
      ];
      const templateSrvMock = {
        replace: jest.fn((a) => a), // return the input string
        getVariables: jest.fn().mockReturnValue(variables),
      } as unknown as TemplateSrv;
      const ds = createDatasource(templateSrvMock);
      const result = ds.interpolateString('foo: $var1 bar: $var2 | $var3', scopedVars);
      expect(result).toStrictEqual('foo:in($var1) bar:in(*) | *');
    })
  });
});
