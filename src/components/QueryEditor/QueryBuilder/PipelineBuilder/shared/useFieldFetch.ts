import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';

import { formattedValueToString, getValueFormat, TimeRange } from '@grafana/data';
import { ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { useTemplateVariables } from '../../../../../hooks/useTemplateVariables';
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
  excludeFields?: string[];
}

export const useFieldFetch = ({ datasource, field, timeRange, queryContext, excludeFields }: Props) => {
  const { extraStreamFilters } = usePipelineContext();
  const { withVariables } = useTemplateVariables();

  const interpolatedQueryContext = useMemo(
    () => queryContext ? datasource.interpolateString(queryContext) : undefined,
    [datasource, queryContext]
  );
  const interpolatedStreamFilters = useMemo(
    () => extraStreamFilters ? datasource.interpolateString(extraStreamFilters) : undefined,
    [datasource, extraStreamFilters]
  );

  const cacheKey = useMemo(
    () => `${interpolatedQueryContext ?? ''}::${interpolatedStreamFilters ?? ''}`,
    [interpolatedQueryContext, interpolatedStreamFilters]
  );

  const customParams = useMemo(() => {
    if (!interpolatedStreamFilters) {
      return datasource.customQueryParameters;
    }
    const params = new URLSearchParams();
    if (datasource.customQueryParameters) {
      for (const [key, value] of datasource.customQueryParameters) {
        params.append(key, value);
      }
    }
    params.set('extra_stream_filters', interpolatedStreamFilters);
    return params;
  }, [datasource.customQueryParameters, interpolatedStreamFilters]);

  const fetchFieldNames = useCallback(async (): Promise<ComboboxOption[]> => {
    const cached = fieldNamesCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldName);

    const list = await datasource.languageProvider?.getFieldList(
      { type: FilterFieldType.FieldName, timeRange, limit, query: interpolatedQueryContext },
      customParams
    );

    const result: ComboboxOption[] = list ? toOptionsWithHits(list) : [];

    fieldNamesCache.set(cacheKey, result);
    return result;
  }, [datasource, timeRange, interpolatedQueryContext, customParams, cacheKey]);

  const filterExcludedFields = useCallback((options: ComboboxOption[]): ComboboxOption[] => {
    if (!excludeFields?.length) {
      return options;
    }
    return options.filter((opt) => !excludeFields.includes(opt.value as string));
  }, [excludeFields]);

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
          query: interpolatedQueryContext,
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
    [datasource, field, timeRange, interpolatedQueryContext, customParams]
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
            resolve(withVariables(filterExcludedFields(filterOptions(allOptions, inputValue)), inputValue));
          });
        } else {
          debouncedFilter(inputValue, resolve, fetchFieldNames, (opts, input) =>
            withVariables(filterExcludedFields(filterOptions(opts, input)), input)
          );
        }
      });
    },
    [fetchFieldNames, filterOptions, filterExcludedFields, debouncedFilter, withVariables]
  );

  const loadFieldValues = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve) => {
        if (!inputValue) {
          fetchFieldValues(inputValue).then((allOptions) => {
            resolve(withVariables(allOptions, inputValue));
          });
        } else {
          debouncedFilter(inputValue, resolve, fetchFieldValues, (opts, input) =>
            withVariables(opts, input)
          );
        }
      });
    },
    [fetchFieldValues, debouncedFilter, withVariables]
  );

  useEffect(() => {
    return () => {
      debouncedFilter.cancel();
    };
  }, [debouncedFilter]);

  return { loadFieldNames, loadFieldValues };
};
