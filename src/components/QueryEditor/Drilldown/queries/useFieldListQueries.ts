import { useEffect, useState } from 'react';

import { DEFAULT_FIELD_DISPLAY_VALUES_LIMIT, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { FieldHits, FilterFieldType, Query } from '../../../../types';

import { errorMessage } from './errorMessage';
import { FacetField, fetchFacets } from './facets';

/** Field names seen in the logs that match `lookupQuery` */
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

/** Stream fields seen in the logs that match `lookupQuery`, with hit counts, sorted by hits descending */
export function useStreamFields(
  datasource: VictoriaLogsDatasource,
  range: TimeRange,
  lookupQuery: string
): { streamFields: FieldHits[]; loading: boolean; error?: string } {
  const [streamFields, setStreamFields] = useState<FieldHits[]>([]);
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
          setStreamFields(values.map((v) => ({ ...v, value: v.value.trim() })).filter((v) => v.value));
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

  return { streamFields, loading, error };
}

/** Top values per field for the current query. Idle until `enabled` */
export function useFacets(
  datasource: VictoriaLogsDatasource,
  query: Query,
  range: TimeRange,
  enabled: boolean
): { facets: FacetField[]; loading: boolean; error?: string } {
  const [facets, setFacets] = useState<FacetField[]>([]);
  // starts true: `enabled` turns on during a render, but the effect below only sets the flag
  // after the paint, so a `false` start would leave one frame of "loaded, and there is nothing"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  // adHocFilters is a new array on every render, so the effect keys off its contents instead
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
