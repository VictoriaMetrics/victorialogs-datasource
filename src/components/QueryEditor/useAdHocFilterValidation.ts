import { useEffect, useMemo, useRef, useState } from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../datasource';
import { FilterFieldType, Query } from '../../types';
import { LRUCache } from '../../utils/LRUCache';
import { bucketTimeRange } from '../../utils/timeUtils';

import { buildStreamExtraFilters } from './StreamFilters/streamFilterUtils';

const FIELD_NAMES_BATCH_LIMIT = 10_000;
const BUCKET_CACHE_SIZE = 16;

export type AdHocFilterValidationState = 'loading' | 'valid' | 'invalid';

interface Args {
  datasource: VictoriaLogsDatasource;
  query: Query;
  timeRange?: TimeRange;
  fieldNames: string[];
}

type KnownFields = Set<string> | 'errored' | undefined;

const streamFiltersKey = (filters: Query['streamFilters']): string =>
  (filters ?? []).map((f) => `${f.label}|${f.operator}|${f.values.join(',')}`).join(';');

const withExtraStreamFilters = (
  base: URLSearchParams | undefined,
  extra: string | undefined,
): URLSearchParams | undefined => {
  if (!extra) {
    return base;
  }
  const params = new URLSearchParams(base);
  params.set('extra_stream_filters', extra);
  return params;
};

export const useAdHocFilterValidation = ({
  datasource,
  query,
  timeRange,
  fieldNames,
}: Args): Record<string, AdHocFilterValidationState> => {
  const [known, setKnown] = useState<KnownFields>(undefined);
  const cacheRef = useRef(new LRUCache<Set<string>>(BUCKET_CACHE_SIZE));
  const requestIdRef = useRef(0);

  const bucketed = useMemo(
    () => (timeRange ? bucketTimeRange(timeRange) : undefined),
    [timeRange],
  );

  const cacheKey = `${bucketed?.from.valueOf() ?? ''}::${bucketed?.to.valueOf() ?? ''}::${streamFiltersKey(query.streamFilters)}`;
  const hasFields = fieldNames.length > 0;

  useEffect(() => {
    if (!hasFields) {
      return;
    }

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setKnown(cached);
      return;
    }

    // Drop stale data from a previous query context while the new fetch is in flight.
    setKnown(undefined);

    const provider = datasource.languageProvider;
    if (!provider) {
      return;
    }

    const interpolate = (s: string) => datasource.interpolateString(s);
    const extraStreamFilters = buildStreamExtraFilters(query.streamFilters ?? []) || undefined;
    const customParams = withExtraStreamFilters(
      datasource.customQueryParameters,
      extraStreamFilters ? interpolate(extraStreamFilters) : undefined,
    );

    const requestId = ++requestIdRef.current;

    provider
      .getFieldList(
        {
          type: FilterFieldType.FieldName,
          query: '*',
          timeRange: bucketed,
          limit: FIELD_NAMES_BATCH_LIMIT,
        },
        customParams,
      )
      .then((list) => {
        const set = new Set((list ?? []).map((h) => h.value));
        // Always populate the LRU keyed by the captured cacheKey, even if this
        // request is no longer the latest — the data is still correct for that key.
        cacheRef.current.set(cacheKey, set);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setKnown(set);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        // Network/server failure — fall back to 'valid' for all and skip caching.
        setKnown('errored');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, cacheKey, hasFields]);

  return useMemo<Record<string, AdHocFilterValidationState>>(() => {
    if (!hasFields || known === undefined) {
      return {};
    }
    const interpolate = (s: string) => datasource.interpolateString(s);
    return Object.fromEntries(
      fieldNames.map((name): [string, AdHocFilterValidationState] => {
        const interpolated = interpolate(name);
        if (interpolated.includes('$') || known === 'errored') {
          return [name, 'valid'];
        }
        return [name, known.has(interpolated) ? 'valid' : 'invalid'];
      }),
    );
  }, [fieldNames, hasFields, known, datasource]);
};
