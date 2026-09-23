import { FACETS_VALUES_LIMIT, fetchFacets } from './facets';
import { makeFacetsDatasource, query, range } from './hookTestUtils';

describe('fetchFacets', () => {
  it('maps the facets response to fields with their value hits', async () => {
    const datasource = makeFacetsDatasource();
    const fields = await fetchFacets(datasource, query, range);
    expect(fields).toEqual([{ name: 'app', values: [{ value: 'web', hits: 3 }] }]);
    expect(datasource.postResource).toHaveBeenCalledWith(
      'select/logsql/facets',
      expect.objectContaining({ query: 'error', limit: String(FACETS_VALUES_LIMIT), keep_const_fields: '1' })
    );
  });

  it('sends the custom query parameters, letting the endpoint-specific ones win on a clash', async () => {
    const datasource = makeFacetsDatasource({ customQueryParameters: new URLSearchParams({ tenant: 't1', limit: '999' }) });
    await fetchFacets(datasource, query, range);
    const params = (datasource.postResource as jest.Mock).mock.calls[0][1];
    expect(params.tenant).toBe('t1');
    expect(params.limit).toBe(String(FACETS_VALUES_LIMIT));
  });
});
