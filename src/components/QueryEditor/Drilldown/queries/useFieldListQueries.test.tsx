import { renderHook, waitFor } from '@testing-library/react';

import { VictoriaLogsDatasource } from '../../../../datasource';

import { makeDatasource, range } from './hookTestUtils';
import { useFieldNames, useStreamFields } from './useFieldListQueries';

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
      expect.objectContaining({ query: '*', timeRange: range })
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
