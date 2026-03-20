import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';

import { formattedValueToString, getValueFormat, TimeRange } from '@grafana/data';
import { ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { FieldHits, FilterFieldType } from '../../../../../types';
import { LRUCache } from '../../../../../utils/LRUCache';

import { usePipelineContext } from './PipelineContext';

const DEBOUNCE_MS = 300;
const MAX_VISIBLE_OPTIONS = 1000;

const fieldNamesCache = new LRUCache<ComboboxOption[]>(50);

const shortFormat = getValueFormat('short');
const formatHits = (hits: number): string => formattedValueToString(shortFormat(hits));

const toOptionsWithHits = (list: FieldHits[]): ComboboxOption[] => {
  const sorted = [...list].sort((a, b) => b.hits - a.hits);
  const totalHits = sorted.reduce((sum, item) => sum + item.hits, 0);
  return sorted.map(({ value, hits }) => ({
    value: value || '',
    label: value || ' ',
    description: `hits: ${formatHits(hits)}${totalHits > 0 ? ` (${((hits / totalHits) * 100).toFixed(1)}%)` : ''}`,
  }));
};

interface Props {
  datasource: VictoriaLogsDatasource;
  field?: string;
  timeRange?: TimeRange;
  queryContext?: string;
}

export const useFieldFetch = ({ datasource, field, timeRange, queryContext }: Props) => {
  const { extraStreamFilters } = usePipelineContext();
  const cacheKey = useMemo(() => `${queryContext ?? ''}::${extraStreamFilters ?? ''}`, [queryContext, extraStreamFilters]);

  const customParams = useMemo(() => {
    if (!extraStreamFilters) {
      return datasource.customQueryParameters;
    }
    const params = new URLSearchParams();
    if (datasource.customQueryParameters) {
      for (const [key, value] of datasource.customQueryParameters) {
        params.append(key, value);
      }
    }
    params.set('extra_stream_filters', extraStreamFilters);
    return params;
  }, [datasource.customQueryParameters, extraStreamFilters]);

  const fetchFieldNames = useCallback(async (): Promise<ComboboxOption[]> => {
    const cached = fieldNamesCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldName);

    const list = await datasource.languageProvider?.getFieldList(
      { type: FilterFieldType.FieldName, timeRange, limit, query: queryContext },
      customParams
    );

    const result: ComboboxOption[] = list ? toOptionsWithHits(list) : [];

    fieldNamesCache.set(cacheKey, result);
    return result;
  }, [datasource, timeRange, queryContext, customParams, cacheKey]);

  const fetchFieldValues = useCallback(
    async (inputValue: string): Promise<ComboboxOption[]> => {
      const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldValue) || MAX_VISIBLE_OPTIONS;

      const list = await datasource.languageProvider?.getFieldList(
        {
          type: FilterFieldType.FieldValue,
          timeRange,
          field,
          limit,
          fieldValueFilter: inputValue || undefined,
          query: queryContext,
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
          description: `The server returned first ${limit} values. You can increase the limit in datasource settings.`,
          infoOption: true,
        });
      }

      options.push(...toOptionsWithHits(list));

      return options;
    },
    [datasource, field, timeRange, queryContext, customParams]
  );

  const filterOptions = useCallback((options: ComboboxOption[], inputValue: string): ComboboxOption[] => {
    if (!inputValue) {
      return options.slice(0, MAX_VISIBLE_OPTIONS);
    }

    const lowerInput = inputValue.toLowerCase();
    const filtered = options.filter(
      (opt) => opt.label?.toLowerCase().includes(lowerInput) || opt.value?.toLowerCase().includes(lowerInput)
    );

    return filtered.slice(0, MAX_VISIBLE_OPTIONS);
  }, []);

  const debouncedFilter = useMemo(
    () =>
      debounce(
        async (
          inputValue: string,
          resolve: (options: ComboboxOption[]) => void,
          fetchFn: (inputValue: string) => Promise<ComboboxOption[]>,
          filterFn?: (options: ComboboxOption[], input: string) => ComboboxOption[]
        ) => {
          const allOptions = await fetchFn(inputValue);
          const filteredOptions = filterFn ? filterFn(allOptions, inputValue) : allOptions;
          resolve(filteredOptions);
        },
        DEBOUNCE_MS
      ),
    []
  );

  const loadFieldNames = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve) => {
        if (!inputValue) {
          fetchFieldNames().then((allOptions) => {
            resolve(filterOptions(allOptions, inputValue));
          });
        } else {
          debouncedFilter(inputValue, resolve, fetchFieldNames, filterOptions);
        }
      });
    },
    [fetchFieldNames, filterOptions, debouncedFilter]
  );

  const loadFieldValues = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve) => {
        if (!inputValue) {
          fetchFieldValues(inputValue).then((allOptions) => {
            resolve(allOptions);
          });
        } else {
          debouncedFilter(inputValue, resolve, fetchFieldValues);
        }
      });
    },
    [fetchFieldValues, debouncedFilter]
  );

  useEffect(() => {
    return () => {
      debouncedFilter.cancel();
    };
  }, [debouncedFilter]);

  return { loadFieldNames, loadFieldValues };
};
