import { QueryVariableModel } from "@grafana/data";

import { replaceAllOptionInQuery } from "./replaceAllOptionInQuery";

describe('replaceAllOptionInQuery', () => {
  it('should replace variables with custom allValue', () => {
    const queryExpr = 'namespace: $namespace';
    const variable: QueryVariableModel = {
      name: 'namespace',
      allValue: 'all_namespaces',
      options: [],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace: all_namespaces');
  });

  it('should use options list if allValue is not provided and allowCustomValue', () => {
    const queryExpr = 'namespace:~"$namespace"';
    const variable = {
      name: 'namespace',
      allValue: null,
      allowCustomValue: true,
      options: [{ value: 'ns1' }, { value: 'ns2' }],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:~"(\"ns1\"|\"ns2\")"');
  });

  it('should use options list if allValue is not provided and query defined', () => {
    const queryExpr = 'namespace:~"$namespace"';
    const variable = {
      name: 'namespace',
      allValue: null,
      options: [{ value: 'ns1' }, { value: 'ns2' }],
      query: {
        query: 'filter'
      }
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:~"(\"ns1\"|\"ns2\")"');
  });

  it('should use default wildcard if allValue and options are missing', () => {
    const queryExpr = 'namespace:~"$namespace"';
    const variable = {
      name: 'namespace',
      allValue: null,
      options: [],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:~".*"');
  });

  it('should replace variables when regex and allowCustomValue are enabled', () => {
    const queryExpr = 'namespace:~"$namespace"';
    const variable = {
      name: 'namespace',
      allValue: null,
      allowCustomValue: true,
      regex: true,
      options: [{ value: 'ns1' }, { value: 'ns2' }],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:~"(\"ns1\"|\"ns2\")"');
  });

  it('should replace multiple occurrences of the same variable', () => {
    const queryExpr = 'namespace:$namespace AND pod:$namespace';
    const variable = {
      name: 'namespace',
      allValue: 'all_namespaces',
      options: [],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:all_namespaces AND pod:all_namespaces');
  });

  it('should change .* on * for non regexp operator', () => {
    const queryExpr = 'namespace:~"$namespace" pod:in($namespace)';
    const variable = {
      name: 'namespace',
      allValue: '.*',
      options: [],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:~".*" pod:in(*)');
  });

  it('should change * on .* for regexp operator', () => {
    const queryExpr = 'namespace:~"$namespace" pod:in($namespace)';
    const variable = {
      name: 'namespace',
      allValue: '*',
      options: [],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:~".*" pod:in(*)');
  });

  it('should change only foo as word', () => {
    const queryExpr = 'namespace:in($foo) pod:in($foobar)';
    const variable = {
      name: 'foo',
      allValue: '*',
      options: [],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:in(*) pod:in($foobar)');
  });

  it('should change only foo as word in regexp', () => {
    const queryExpr = 'namespace:~"$foo" pod:~"$foobar"';
    const variable = {
      name: 'foo',
      allValue: '*',
      options: [],
    } as any;

    const result = replaceAllOptionInQuery(queryExpr, variable);
    expect(result).toBe('namespace:~".*" pod:~"$foobar"');
  });
});
