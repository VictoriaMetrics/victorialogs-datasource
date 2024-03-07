import { TemplateSrv } from "@grafana/runtime";

import { createDatasource } from "./__mocks__/datasource";
import { VictoriaLogsDatasource } from "./datasource";

const replaceMock = jest.fn().mockImplementation((a: string) => a);

const templateSrvStub = {
  replace: replaceMock,
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

    it('should only escape single quotes for string value', () => {
      expect(ds.interpolateQueryExpr("abc'$^*{}[]+?.()|", customVariable)).toEqual("abc\\\\'$^*{}[]+?.()|");
    });

    it('should return a number for number value', () => {
      expect(ds.interpolateQueryExpr(1000 as any, customVariable)).toEqual(1000);
    });
  });

  describe('applyTemplateVariables', () => {
    it('should call replace function for expr', () => {
      const expr = '_stream:{app!~"$name"}'
      const variables = { name: 'bar' };
      replaceMock.mockImplementation(() => `_stream:{app!~"${variables.name}"}`);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe(`_stream:{app!~"bar"}`);
    });

    it('should replace variables in a simple string query', () => {
      const expr = 'error';
      replaceMock.mockImplementation((input) => input);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe('error');
    });

    it('should replace variables with logical operators', () => {
      const expr = '$severity AND _time:$time';
      const variables = { severity: 'error', time: '5m' };
      replaceMock.mockImplementation(() => `${variables.severity} AND _time:${variables.time}`);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe('error AND _time:5m');
    });

    it('should replace variables with exact match function', () => {
      const expr = 'log.level:exact("$level")';
      const variables = { level: 'error' };
      replaceMock.mockImplementation(() => `log.level:exact("${variables.level}")`);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe('log.level:exact("error")');
    });

    it('should not replace a variable if it is not declared', () => {
      const expr = '_stream:{app!~"$undeclaredVariable"}';
      replaceMock.mockImplementation((input) => input);
      const interpolatedQuery = ds.applyTemplateVariables({ expr, refId: 'A' }, {});
      expect(interpolatedQuery.expr).toBe(expr);
    });
  });
});
