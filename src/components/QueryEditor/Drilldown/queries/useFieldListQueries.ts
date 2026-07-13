import { useEffect, useState } from 'react';

import { DEFAULT_FIELD_DISPLAY_VALUES_LIMIT, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { FilterFieldType, Query } from '../../../../types';

import { errorMessage } from './errorMessage';
import { FacetField, fetchFacets } from './facets';

/** Loads the list of field names seen in the logs matching `lookupQuery` for the current time range */
export function useFieldNames(
  datasource: VictoriaLogsDatasource,
  range: TimeRange,
  lookupQuery: string
): { fieldNames: string[]; loading: boolean; error?: string } {
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    datasource.languageProvider
      ?.getFieldList(
        {
          type: FilterFieldType.FieldName,
          timeRange: range,
          limit: DEFAULT_FIELD_DISPLAY_VALUES_LIMIT,
          query: lookupQuery,
        },
        datasource.customQueryParameters
      )
      .then((values) => {
        if (!cancelled) {
          setFieldNames(values.map((v) => v.value.trim()).filter(Boolean));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, lookupQuery, range.from.valueOf(), range.to.valueOf()]);

  return { fieldNames, loading, error };
}

/** Loads the list of stream field names seen in the logs matching `lookupQuery` for the current time range */
export function useStreamFieldNames(
  datasource: VictoriaLogsDatasource,
  range: TimeRange,
  lookupQuery: string
): { streamFieldNames: string[]; loading: boolean; error?: string } {
  const [streamFieldNames, setStreamFieldNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    datasource.languageProvider
      ?.getStreamFieldList({ type: FilterFieldType.FieldName, timeRange: range, query: lookupQuery })
      .then((values) => {
        if (!cancelled) {
          setStreamFieldNames(values.map((v) => v.value.trim()).filter(Boolean));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, lookupQuery, range.from.valueOf(), range.to.valueOf()]);

  return { streamFieldNames, loading, error };
}

/** Loads the per-field top values (facets) for the current query; idle until enabled */
export function useFacets(
  datasource: VictoriaLogsDatasource,
  query: Query,
  range: TimeRange,
  enabled: boolean
): { facets: FacetField[]; loading: boolean; error?: string } {
  const [facets, setFacets] = useState<FacetField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // adHocFilters is a new array/object on every render even when its contents are unchanged —
  // a stable string key is needed so the effect only re-runs when the filters actually change
  const filtersKey = JSON.stringify(query.adHocFilters ?? []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fetchFacets(datasource, query, range)
      .then((fields) => {
        if (!cancelled) {
          setFacets(fields);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, enabled, query.expr, filtersKey, range.from.valueOf(), range.to.valueOf()]);

  return { facets, loading, error };
}
