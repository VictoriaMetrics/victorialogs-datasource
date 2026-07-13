import { renderHook, waitFor } from '@testing-library/react';

import { VictoriaLogsDatasource } from '../../../../datasource';

import { makeDatasource, range } from './hookTestUtils';
import { useFieldNames } from './useFieldListQueries';

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
