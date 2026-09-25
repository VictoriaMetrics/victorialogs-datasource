import { renderHook, waitFor } from '@testing-library/react';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import { facetsResponse, makeDatasource, makeFacetsDatasource, query, range } from './hookTestUtils';
import { drilldownQueryScheduler } from './queryScheduler';
import { useFacets, useFieldNames, useStreamFields } from './useFieldListQueries';

describe('useFieldNames', () => {
  it('loads field names via the language provider, narrowed by the lookup query', async () => {
    const datasource = makeDatasource();
    const { result } = renderHook(() => useFieldNames(datasource, range, '*'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fieldNames).toEqual(['level', 'app']);
    expect(datasource.languageProvider?.getFieldList).toHaveBeenCalledWith(
      expect.objectContaining({ query: '*', timeRange: range }),
      expect.anything()
    );
  });

  it('reports an error when the field names request rejects', async () => {
    const datasource = makeDatasource({
      languageProvider: { getFieldList: jest.fn().mockRejectedValue(new Error('boom')) },
    } as unknown as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useFieldNames(datasource, range, '*'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.fieldNames).toEqual([]);
  });
});

describe('useStreamFields', () => {
  it('loads the stream fields with their hit counts, dropping blank names', async () => {
    const datasource = makeDatasource({
      languageProvider: {
        getStreamFieldList: jest.fn().mockResolvedValue([
          { value: 'namespace ', hits: 42 },
          { value: 'pod', hits: 7 },
          { value: '  ', hits: 1 },
        ]),
      },
    } as unknown as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useStreamFields(datasource, range, '*'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streamFields).toEqual([
      { value: 'namespace', hits: 42 },
      { value: 'pod', hits: 7 },
    ]);
    expect(datasource.languageProvider?.getStreamFieldList).toHaveBeenCalledWith(
      expect.objectContaining({ query: '*', timeRange: range }),
      datasource.customQueryParameters
    );
  });

  it('reports an error when the stream fields request rejects', async () => {
    const datasource = makeDatasource({
      languageProvider: { getStreamFieldList: jest.fn().mockRejectedValue(new Error('boom')) },
    } as unknown as Partial<VictoriaLogsDatasource>);
    const { result } = renderHook(() => useStreamFields(datasource, range, '*'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.streamFields).toEqual([]);
  });
});

describe('useFacets', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stays idle until enabled', () => {
    const postResource = jest.fn().mockResolvedValue(facetsResponse);
    const datasource = makeFacetsDatasource({ postResource });
    renderHook(() => useFacets(datasource, query, range, false));
    expect(postResource).not.toHaveBeenCalled();
  });

  it('loads the facets through the shared drilldown scheduler', async () => {
    const scheduleSpy = jest.spyOn(drilldownQueryScheduler, 'schedule');
    const datasource = makeFacetsDatasource();
    const { result } = renderHook(() => useFacets(datasource, query, range, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(result.current.facets).toEqual([{ name: 'app', values: [{ value: 'web', hits: 3 }] }]);
    expect(result.current.error).toBeUndefined();
  });

  it('reports an error when the facets request rejects', async () => {
    const datasource = makeFacetsDatasource({ postResource: jest.fn().mockRejectedValue(new Error('facets failed')) });
    const { result } = renderHook(() => useFacets(datasource, query, range, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('facets failed');
    expect(result.current.facets).toEqual([]);
  });

  it('ignores the reply of a request superseded by a filter change', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const postResource = jest
      .fn()
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue({ facets: [{ field_name: 'level', values: [] }] });
    const datasource = makeFacetsDatasource({ postResource });
    const { result, rerender } = renderHook(({ q }: { q: Query }) => useFacets(datasource, q, range, true), {
      initialProps: { q: query },
    });
    rerender({ q: { ...query, adHocFilters: [{ key: 'app', operator: '=', value: 'web' }] } });
    await waitFor(() => expect(result.current.loading).toBe(false));

    resolveFirst(facetsResponse);
    await Promise.resolve();

    expect(postResource).toHaveBeenCalledTimes(2);
    expect(result.current.facets).toEqual([{ name: 'level', values: [] }]);
  });
});
