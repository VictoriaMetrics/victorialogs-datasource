import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { FieldHits, Query } from '../../../../types';
import { serializeChipsForBackend } from '../../../../utils/query/adHocFilters';

/** How many top values per field the facets request returns (VictoriaLogs default) */
export const FACETS_VALUES_LIMIT = 10;

/** One log field with its most frequent values, as returned by /select/logsql/facets */
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
 * Fetches the most frequent values per log field for the given query via the
 * /select/logsql/facets endpoint (proxied by the plugin backend). The query's
 * adHocFilters are passed as `extra_filters`, matching how datasource.query()
 * serializes them for every other drilldown request
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
    // fields constant across the whole selection are excluded by default; the drilldown
    // narrows the selection with filters, so const fields are the norm and must be kept
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
