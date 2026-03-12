import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { TimeRange } from '@grafana/data';
import { ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { FilterFieldType } from '../../../../../types';

const DEBOUNCE_MS = 300;
const MAX_VISIBLE_OPTIONS = 1000;

interface Props {
  datasource: VictoriaLogsDatasource;
  field?: string;
  timeRange?: TimeRange;
}

export const useFieldFetch = ({ datasource, field, timeRange }: Props) => {
  const fieldNamesCache = useRef<ComboboxOption[]>([]);

  const fetchFieldNames = useCallback(async (): Promise<ComboboxOption[]> => {
    if (fieldNamesCache.current.length > 0) {
      return fieldNamesCache.current;
    }

    const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldName);

    const list = await datasource.languageProvider?.getFieldList(
      { type: FilterFieldType.FieldName, timeRange, limit },
      datasource.customQueryParameters
    );

    const result: ComboboxOption[] = list
      ? list.map(({ value, hits }) => ({
        value: value || '',
        label: value || ' ',
        description: `hits: ${hits}`,
      }))
      : [];

    fieldNamesCache.current = result;
    return result;
  }, [datasource, timeRange]);

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
        },
        datasource.customQueryParameters
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

      const mappedOptions = list.map(({ value, hits }) => ({
        value: value || '',
        label: value || ' ',
        description: `hits: ${hits}`,
      }));
      options.push(...mappedOptions);

      return options;
    },
    [datasource, field, timeRange]
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
