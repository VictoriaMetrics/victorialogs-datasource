import { debounce } from "lodash";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { TimeRange } from "@grafana/data";
import { ComboboxOption } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../../../../datasource";
import { FilterFieldType, VisualQuery } from "../../../../../types";
import { deleteByIndexPath } from "../../utils/modifyFilterVisualQuery/deleteByIndexPath";
import { filterVisualQueryToString } from "../../utils/parseToString";

const DEBOUNCE_MS = 300;
const MAX_VISIBLE_OPTIONS = 1000;

interface Props {
  datasource: VictoriaLogsDatasource;
  query: VisualQuery;
  field?: string;
  indexPath: number[];
  timeRange?: TimeRange;
}

export const useFetchFilters = ({
  datasource,
  query,
  field,
  indexPath,
  timeRange,
}: Props) => {
  // Cache for all loaded field names to enable client-side filtering
  const fieldNamesCache = useRef<ComboboxOption[]>([]);

  // Fetch and cache field names (client-side filtering)
  const fetchFieldNames = useCallback(async (): Promise<ComboboxOption[]> => {
    // Return cached data if available
    if (fieldNamesCache.current.length > 0) {
      return fieldNamesCache.current;
    }

    const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldName);
    const filtersWithoutCurrent = deleteByIndexPath(query.filters, indexPath);
    const currentOperator = query.filters.operators[indexPath[0] - 1] || "AND";
    const filters = currentOperator === "AND" ? filterVisualQueryToString(filtersWithoutCurrent, true) : "";

    const list = await datasource.languageProvider?.getFieldList(
      { type: FilterFieldType.FieldName, timeRange, field, limit, query: filters },
      datasource.customQueryParameters
    );

    const result: ComboboxOption[] = list ? list.map(({ value, hits }) => ({
      value: value || "",
      label: value || " ",
      description: `hits: ${hits}`,
    })) : [];

    fieldNamesCache.current = result;
    return result;
  }, [datasource, field, indexPath, query.filters, timeRange]);

  // Fetch field values with server-side filtering via fieldValueFilter parameter
  // Caching is handled by language_provider based on query+fieldValueFilter combination
  const fetchFieldValues = useCallback(
    async (
      inputValue: string,
    ): Promise<ComboboxOption[]> => {
      const limit = datasource.getQueryBuilderLimits(FilterFieldType.FieldValue) || MAX_VISIBLE_OPTIONS;
      const filtersWithoutCurrent = deleteByIndexPath(query.filters, indexPath);
      const currentOperator = query.filters.operators[indexPath[0] - 1] || "AND";
      const filters = currentOperator === "AND" ? filterVisualQueryToString(filtersWithoutCurrent, true) : "";

      const list = await datasource.languageProvider?.getFieldList(
        {
          type: FilterFieldType.FieldValue,
          timeRange,
          field,
          limit,
          query: filters,
          fieldValueFilter: inputValue || undefined, // Server-side search value
        },
        datasource.customQueryParameters
      );

      if (!list) {
        return [];
      }

      const limitReached =  limit > 0 && list.length >= limit;
      const options: ComboboxOption[] = [];
      // Show warning if limit was reached
      if (limitReached) {
        const warningOption: ComboboxOption = {
          value: "",
          label: "Too many distinct values. Please type more characters",
          description: `The server returned first ${limit} values. You can increase the limit in datasource settings, but be aware of potential performance issues.`,
          infoOption: true
        };
        options.push(warningOption);
      }

      const mappedOptions = list.map(({ value, hits }) => ({
        value: value || "",
        label: value || " ",
        description: `hits: ${hits}`,
      }));
      options.push(...mappedOptions);

      return options;
    },
    [datasource, field, indexPath, query.filters, timeRange]
  );

  // Filter options client-side (used for field names)
  const filterOptions = useCallback((options: ComboboxOption[], inputValue: string): ComboboxOption[] => {
    if (!inputValue) {
      // Return first MAX_VISIBLE_OPTIONS when no search
      return options.slice(0, MAX_VISIBLE_OPTIONS);
    }

    const lowerInput = inputValue.toLowerCase();
    const filtered = options.filter(
      (opt) => opt.label?.toLowerCase().includes(lowerInput) || opt.value?.toLowerCase().includes(lowerInput)
    );

    return filtered.slice(0, MAX_VISIBLE_OPTIONS);
  }, []);

  // Single debounced function for filtering options
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

  // Async options loader for field names with debounce (client-side filtering)
  const loadFieldNames = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve) => {
        if (!inputValue) {
          // No debounce on initial load
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

  // Async options loader for field names with debounce (server-side filtering)
  const loadFieldValues = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return new Promise((resolve) => {
        if (!inputValue) {
          // No debounce on initial load
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

  // Reset cache when query filters change
  useEffect(() => {
    fieldNamesCache.current = [];
  }, [query.filters]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedFilter.cancel();
    };
  }, [debouncedFilter]);

  return { loadFieldNames, loadFieldValues };
};
