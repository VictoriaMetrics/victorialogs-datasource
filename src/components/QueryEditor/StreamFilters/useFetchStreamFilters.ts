import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { formattedValueToString, getValueFormat, TimeRange } from '@grafana/data';
import { ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { FilterFieldType } from '../../../types';

const DEBOUNCE_MS = 300;
const MAX_VISIBLE_OPTIONS = 1000;

const shortFormat = getValueFormat('short');
const formatHits = (hits: number): string => formattedValueToString(shortFormat(hits));
const formatHitPercentage = (hits: number, totalHits: number): string => {
  if (totalHits <= 0) {
    return '';
  }

  return ` (${((hits / totalHits) * 100).toFixed(1)}%)`;
};

interface Props {
  datasource: VictoriaLogsDatasource;
  fieldName?: string;
  timeRange?: TimeRange;
  /** query expression from the editor to scope stream filter results */
  queryExpr?: string;
  /** extra_stream_filters built from preceding filters to scope values */
  extraStreamFilters?: string;
  /** label names already used by other filters — will be excluded from the dropdown */
  excludeLabels?: Set<string>;
}

export const useFetchStreamFilters = ({
  datasource,
  fieldName,
  timeRange,
  queryExpr,
  extraStreamFilters,
  excludeLabels,
}: Props) => {
  const fieldNamesCache = useRef<ComboboxOption[]>([]);

  // Fetch and cache stream field names (client-side filtering)
  const fetchStreamFieldNames = useCallback(async (): Promise<ComboboxOption[]> => {
    if (fieldNamesCache.current.length > 0) {
      return fieldNamesCache.current;
    }

    const customParams = new URLSearchParams();
    if (datasource.customQueryParameters) {
      for (const [key, value] of datasource.customQueryParameters) {
        customParams.append(key, value);
      }
    }
    if (extraStreamFilters) {
      customParams.set('extra_stream_filters', extraStreamFilters);
    }

    const list = await datasource.languageProvider?.getStreamFieldList(
      {
        type: FilterFieldType.FieldName,
        timeRange,
        query: queryExpr || undefined,
        ignorePipes: true
      },
      customParams
    );

    if (!list || list.length === 0) {
      fieldNamesCache.current = [];
      return [];
    }

    const result: ComboboxOption[] = list.map(({ value, hits }) => ({
      value: value || '',
      label: value || ' ',
      description: `${formatHits(hits)}`,
    }));

    fieldNamesCache.current = result;
    return result;
  }, [datasource.customQueryParameters, datasource.languageProvider, extraStreamFilters, timeRange, queryExpr]);

  // Fetch stream field values with server-side filtering
  const fetchStreamFieldValues = useCallback(
    async (inputValue: string): Promise<ComboboxOption[]> => {
      if (!fieldName) {
        return [];
      }

      const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldValue) || MAX_VISIBLE_OPTIONS;

      const customParams = new URLSearchParams();
      if (datasource.customQueryParameters) {
        for (const [key, value] of datasource.customQueryParameters) {
          customParams.append(key, value);
        }
      }
      if (extraStreamFilters) {
        customParams.set('extra_stream_filters', extraStreamFilters);
      }

      const list = await datasource.languageProvider?.getStreamFieldList(
        {
          type: FilterFieldType.FieldValue,
          timeRange,
          field: fieldName,
          limit,
          fieldValueFilter: inputValue || undefined,
          query: queryExpr || undefined,
          ignorePipes: true
        },
        customParams
      );

      if (!list) {
        return [];
      }

      const limitReached = limit > 0 && list.length >= limit;
      const options: ComboboxOption[] = [];

      if (limitReached) {
        options.push({
          value: '',
          label: 'Too many distinct values. Please type more characters',
          description: `The server returned first ${limit} values. You can increase the limit in datasource settings`,
          infoOption: true,
        });
      }

      const totalHits = list.reduce((sum, item) => sum + item.hits, 0);
      const mappedOptions = list.map(({ value, hits }) => ({
        value: value || '',
        label: value || ' ',
        description: `${formatHits(hits)}${formatHitPercentage(hits, totalHits)}`,
      }));
      options.push(...mappedOptions);

      return options;
    },
    [fieldName, datasource, extraStreamFilters, timeRange, queryExpr]
  );

  // Client-side filter for field names — also excludes already-used labels
  const filterFieldNamesOptions = useCallback(
    (options: ComboboxOption[], inputValue: string): ComboboxOption[] => {
      let filtered = options;

      // Exclude labels already used by other filters
      if (excludeLabels && excludeLabels.size > 0) {
        filtered = filtered.filter((opt) => !excludeLabels.has(opt.value || ''));
      }

      return filterOptions(filtered, inputValue);
    },
    [excludeLabels]
  );

  const pendingResolve = useRef<((options: ComboboxOption[]) => void) | null>(null);

  const debouncedFilter = useMemo(
    () =>
      debounce(
        async (
          inputValue: string,
          resolve: (options: ComboboxOption[]) => void,
          reject: (err: unknown) => void,
          fetchFn: (inputValue: string) => Promise<ComboboxOption[]>,
          filterFn?: (options: ComboboxOption[], input: string) => ComboboxOption[]
        ) => {
          try {
            const allOptions = await fetchFn(inputValue);
            const filteredOptions = filterFn ? filterFn(allOptions, inputValue) : allOptions;
            resolve(filteredOptions);
          } catch (err) {
            reject(err);
          }
        },
        DEBOUNCE_MS
      ),
    []
  );

  // Resolve any superseded pending promise before scheduling a new debounced call
  const scheduleDebouncedFilter = useCallback(
    (
      inputValue: string,
      resolve: (options: ComboboxOption[]) => void,
      reject: (err: unknown) => void,
      fetchFn: (inputValue: string) => Promise<ComboboxOption[]>,
      filterFn?: (options: ComboboxOption[], input: string) => ComboboxOption[]
    ) => {
      if (pendingResolve.current) {
        pendingResolve.current([]);
      }
      pendingResolve.current = resolve;
      debouncedFilter(inputValue, (...args) => {
        if (pendingResolve.current === resolve) {
          pendingResolve.current = null;
        }
        resolve(...args);
      }, reject, fetchFn, filterFn);
    },
    [debouncedFilter]
  );

  // Async options loader for stream field names with debounce (client-side filtering)
  const loadStreamFieldNames = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve, reject) => {
        if (!inputValue) {
          fetchStreamFieldNames()
            .then((allOptions) => resolve(filterFieldNamesOptions(allOptions, inputValue)))
            .catch(reject);
        } else {
          scheduleDebouncedFilter(inputValue, resolve, reject, fetchStreamFieldNames, filterFieldNamesOptions);
        }
      });
    },
    [fetchStreamFieldNames, filterFieldNamesOptions, scheduleDebouncedFilter]
  );

  // Async options loader for stream field values with debounce (server-side filtering)
  const loadStreamFieldValues = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve, reject) => {
        if (!inputValue) {
          fetchStreamFieldValues(inputValue)
            .then(resolve)
            .catch(reject);
        } else {
          scheduleDebouncedFilter(inputValue, resolve, reject, fetchStreamFieldValues, filterOptions);
        }
      });
    },
    [fetchStreamFieldValues, scheduleDebouncedFilter]
  );

  // Reset field names cache when dependencies change
  useEffect(() => {
    fieldNamesCache.current = [];
  }, [timeRange, extraStreamFilters, queryExpr]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedFilter.cancel();
    };
  }, [debouncedFilter]);

  return { loadStreamFieldNames, loadStreamFieldValues };
};

// Client-side filter for labels
const filterOptions = (options: ComboboxOption[], inputValue: string): ComboboxOption[] => {
  let filtered = options;
  if (inputValue) {
    const lowerInput = inputValue.toLowerCase();
    filtered = filtered.filter(
      (opt) => opt.label?.toLowerCase().includes(lowerInput) || opt.value?.toLowerCase().includes(lowerInput)
    );
  }
  return filtered.slice(0, MAX_VISIBLE_OPTIONS);
};
