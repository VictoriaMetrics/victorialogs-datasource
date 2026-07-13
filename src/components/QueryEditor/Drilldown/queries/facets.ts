import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { FieldHits, Query } from '../../../../types';
import { serializeChipsForBackend } from '../../../../utils/query/adHocFilters';

/** How many top values per field the facets request returns. This is the VictoriaLogs default */
export const FACETS_VALUES_LIMIT = 10;

/** One field with its most frequent values, as /select/logsql/facets returns them */
export interface FacetField {
  name: string;
  values: FieldHits[];
}

interface FacetsResponse {
  facets?: Array<{
    field_name: string;
    values?: Array<{ field_value: string; hits: number }>;
  }>;
}

/**
 * Fetches the most frequent values per field through /select/logsql/facets, which the plugin
 * backend proxies. The query's adHocFilters travel as `extra_filters`, the way
 * datasource.query() serializes them for every other drilldown request
 */
export async function fetchFacets(
  datasource: VictoriaLogsDatasource,
  query: Query,
  range: TimeRange
): Promise<FacetField[]> {
  const expr = datasource.interpolateString(query.expr ?? '').trim();
  const params: Record<string, string> = {
    query: expr || '*',
    start: String(range.from.valueOf()),
    end: String(range.to.valueOf()),
    limit: String(FACETS_VALUES_LIMIT),
    // by default the endpoint drops the fields that hold one value across the whole selection.
    // The drilldown narrows the selection with filters, which makes such fields the norm here
    keep_const_fields: '1',
  };
  const extraFilters = serializeChipsForBackend(query.adHocFilters, datasource.getActiveLevelRules());
  if (extraFilters) {
    params.extra_filters = extraFilters;
  }
  const res = (await datasource.postResource('select/logsql/facets', params)) as FacetsResponse;
  return (res?.facets ?? []).map((facet) => ({
    name: facet.field_name,
    values: (facet.values ?? []).map(({ field_value, hits }) => ({ value: field_value, hits })),
  }));
}
