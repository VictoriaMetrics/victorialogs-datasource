import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { formattedValueToString, getValueFormat, TimeRange } from '@grafana/data';
import { ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { useTemplateVariables } from '../../../hooks/useTemplateVariables';
import { FieldHits, FilterFieldType } from '../../../types';
import { LRUCache } from '../../../utils/LRUCache';

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
    () => `${interpolatedQueryContext ?? ''}::${interpolatedStreamFilters ?? ''}::${timeRange?.from.valueOf() ?? ''}::${timeRange?.to.valueOf() ?? ''}`,
    [interpolatedQueryContext, interpolatedStreamFilters, timeRange]
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

  const fetchFieldNames = useCallback(async (inputValue: string): Promise<ComboboxOption[]> => {
    const filterCacheKey = `${cacheKey}::${inputValue}`;
    const cached = fieldNamesCache.get(filterCacheKey);
    if (cached) {
      return cached;
    }

    const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldName);

    const list = await datasource.languageProvider?.getFieldList(
      { type: FilterFieldType.FieldName, timeRange, limit, query: interpolatedQueryContext, filter: inputValue || undefined },
      customParams
    );

    const result: ComboboxOption[] = list ? toOptionsWithHits(list) : [];

    fieldNamesCache.set(filterCacheKey, result);
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
          filter: inputValue || undefined,
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

  // Separate debounced functions per loader type — prevents cross-cancellation between
  // concurrent field-names and field-values inputs.
  const debouncedFilterNames = useMemo(
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

  const debouncedFilterValues = useMemo(
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

  // Track pending resolves so that superseded Promises are resolved with [] rather than left dangling.
  const pendingResolveNames = useRef<((options: ComboboxOption[]) => void) | null>(null);
  const pendingResolveValues = useRef<((options: ComboboxOption[]) => void) | null>(null);

  const scheduleNames = useCallback(
    (
      inputValue: string,
      resolve: (options: ComboboxOption[]) => void,
      fetchFn: (inputValue: string) => Promise<ComboboxOption[]>,
      filterFn?: (options: ComboboxOption[], input: string) => ComboboxOption[]
    ) => {
      if (pendingResolveNames.current) {
        pendingResolveNames.current([]);
      }
      pendingResolveNames.current = resolve;
      debouncedFilterNames(inputValue, (...args) => {
        if (pendingResolveNames.current === resolve) {
          pendingResolveNames.current = null;
        }
        resolve(...args);
      }, fetchFn, filterFn);
    },
    [debouncedFilterNames]
  );

  const scheduleValues = useCallback(
    (
      inputValue: string,
      resolve: (options: ComboboxOption[]) => void,
      fetchFn: (inputValue: string) => Promise<ComboboxOption[]>,
      filterFn?: (options: ComboboxOption[], input: string) => ComboboxOption[]
    ) => {
      if (pendingResolveValues.current) {
        pendingResolveValues.current([]);
      }
      pendingResolveValues.current = resolve;
      debouncedFilterValues(inputValue, (...args) => {
        if (pendingResolveValues.current === resolve) {
          pendingResolveValues.current = null;
        }
        resolve(...args);
      }, fetchFn, filterFn);
    },
    [debouncedFilterValues]
  );

  const loadFieldNames = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve) => {
        if (!inputValue) {
          fetchFieldNames('').then((allOptions) => {
            resolve(withVariables(filterExcludedFields(allOptions), inputValue));
          });
        } else {
          scheduleNames(inputValue, resolve, fetchFieldNames, (opts, input) =>
            withVariables(filterExcludedFields(opts), input)
          );
        }
      });
    },
    [fetchFieldNames, filterExcludedFields, scheduleNames, withVariables]
  );

  const loadFieldValues = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve) => {
        if (!inputValue) {
          fetchFieldValues(inputValue).then((allOptions) => {
            resolve(withVariables(allOptions, inputValue));
          });
        } else {
          scheduleValues(inputValue, resolve, fetchFieldValues, (opts, input) =>
            withVariables(opts, input)
          );
        }
      });
    },
    [fetchFieldValues, scheduleValues, withVariables]
  );

  /** Returns a loader function bound to a specific field name. Used by TemplateBuilder
   *  where the field name is not known at hook-init time. */
  const loadFieldValuesForField = useCallback(
    (fieldName: string) => (inputValue: string): Promise<ComboboxOption[]> => {
      const fetchFn = async (iv: string): Promise<ComboboxOption[]> => {
        const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldValue) || MAX_VISIBLE_OPTIONS;
        const list = await datasource.languageProvider?.getFieldList(
          {
            type: FilterFieldType.FieldValue,
            timeRange,
            field: fieldName,
            limit,
            filter: iv || undefined,
            query: interpolatedQueryContext,
          },
          customParams
        );
        if (!list) {
          return [];
        }
        const limitReached = limit > 0 && list.length >= limit;
        const opts: ComboboxOption[] = [];
        if (limitReached) {
          opts.push({
            value: '',
            label: 'Too many distinct values. Please type more characters',
            description: `The server returned first ${limit} values. You can increase the limit in datasource settings.`,
            infoOption: true,
          });
        }
        opts.push(...toOptionsWithHits(list));
        return opts;
      };

      return new Promise((resolve) => {
        if (!inputValue) {
          fetchFn(inputValue).then((allOptions) => {
            resolve(withVariables(allOptions, inputValue));
          });
        } else {
          scheduleValues(inputValue, resolve, fetchFn, (opts, input) => withVariables(opts, input));
        }
      });
    },
    [datasource, timeRange, interpolatedQueryContext, customParams, scheduleValues, withVariables]
  );

  useEffect(() => {
    return () => {
      debouncedFilterNames.cancel();
      debouncedFilterValues.cancel();
    };
  }, [debouncedFilterNames, debouncedFilterValues]);

  return { loadFieldNames, loadFieldValues, loadFieldValuesForField };
};
