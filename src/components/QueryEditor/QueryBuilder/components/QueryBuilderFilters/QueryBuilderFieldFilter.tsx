import { css } from "@emotion/css";
import { debounce } from "lodash";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

import { GrafanaTheme2, SelectableValue, TimeRange } from "@grafana/data";
import { IconButton, Label, useStyles2 } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../../../../datasource";
import { escapeLabelValueInExactSelector } from "../../../../../languageUtils";
import { FilterFieldType, VisualQuery } from "../../../../../types";
import { CompatibleAsyncSelect } from '../../../../CompatibleAsyncSelect';
import { deleteByIndexPath } from '../../utils/modifyFilterVisualQuery/deleteByIndexPath';
import { updateValueByIndexPath } from "../../utils/modifyFilterVisualQuery/updateByIndexPath";
import { DEFAULT_FIELD, filterVisualQueryToString } from "../../utils/parseToString";

const DEBOUNCE_MS = 300;
const MAX_VISIBLE_OPTIONS = 1000;

// Type alias for options
type FieldOption = SelectableValue<string>;

interface Props {
  datasource: VictoriaLogsDatasource;
  filter: string;
  query: VisualQuery;
  indexPath: number[];
  timeRange?: TimeRange;
  onChange: (query: VisualQuery) => void;
}

const QueryBuilderFieldFilter = ({ datasource, filter, query, indexPath, timeRange, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  // Cache for all loaded field names to enable client-side filtering
  const fieldNamesCache = useRef<FieldOption[]>([]);
  const fieldValuesCache = useRef<FieldOption[]>([]);


  const { field, fieldValue } = useMemo(() => {
    const regex = /("[^"]*"|'[^']*'|\S+)\s*:\s*("[^"]*"|'[^']*'|\S+)?|\S+/i
    const matches = filter.match(regex);
    if (!matches || matches.length < 1) {
      return {};
    }
    const field = matches[1] || DEFAULT_FIELD
    let fieldValue = matches[2] ?? (matches[1] ? "" : matches[0])

    // Remove surrounding quotes from fieldValue
    if (fieldValue && ((fieldValue.startsWith('"') && fieldValue.endsWith('"')) ||
        (fieldValue.startsWith("'") && fieldValue.endsWith("'")))) {
      fieldValue = fieldValue.slice(1, -1);
    }

    return { field, fieldValue }
  }, [filter])

  const handleRemoveFilter = useCallback(() => {
    onChange({
      ...query,
      filters: deleteByIndexPath(query.filters, indexPath)
    })
  }, [onChange, query, indexPath])

  const handleSelectFieldName = useCallback((option: { value?: string; label?: string } | null) => {
    if (!option || !option.value) {
      return;
    }
    // Clear field value when field name changes
    const fullFilter = `${option.value}: `

    onChange({
      ...query,
      filters: updateValueByIndexPath(query.filters, indexPath, fullFilter)
    })

    // Reset field values cache when field name changes
    fieldValuesCache.current = [];
  }, [onChange, query, indexPath])

  const handleSelectFieldValue = useCallback((option: { value?: string; label?: string } | null) => {
    if (!option || !option.value) {
      return;
    }
    const fullFilter = `${field || ''}: ${field === '_stream' ? option.value : `"${escapeLabelValueInExactSelector(option.value || "")}"`} `

    onChange({
      ...query,
      filters: updateValueByIndexPath(query.filters, indexPath, fullFilter)
    })
  }, [onChange, query, indexPath, field])

  // Fetch and cache all options, then filter client-side
  const fetchFieldOptions = useCallback(async (type: FilterFieldType): Promise<FieldOption[]> => {
    const cache = type === FilterFieldType.FieldName ? fieldNamesCache : fieldValuesCache;

    // Return cached data if available
    if (cache.current.length > 0) {
      return cache.current;
    }

    const limit = datasource.getQueryBuilderLimits(type);
    const filtersWithoutCurrent = deleteByIndexPath(query.filters, indexPath);
    const currentOperator = query.filters.operators[indexPath[0] - 1] || "AND";
    const filters = currentOperator === "AND" ? filterVisualQueryToString(filtersWithoutCurrent, true) : "";

    const list = await datasource.languageProvider?.getFieldList(
      { type, timeRange, field, limit, query: filters },
      datasource.customQueryParameters
    );

    const result: FieldOption[] = list ? list.map(({ value, hits }) => ({
      value: value || "",
      label: value || " ",
      description: `hits: ${hits}`,
    })) : [];

    cache.current = result;
    return result;
  }, [datasource, field, indexPath, query.filters, timeRange]);

  // Filter options client-side
  const filterOptions = useCallback((
    options: FieldOption[],
    inputValue: string
  ): FieldOption[] => {
    if (!inputValue) {
      // Return first MAX_VISIBLE_OPTIONS when no search
      return options.slice(0, MAX_VISIBLE_OPTIONS);
    }

    const lowerInput = inputValue.toLowerCase();
    const filtered = options.filter(opt =>
      opt.label?.toLowerCase().includes(lowerInput) ||
      opt.value?.toLowerCase().includes(lowerInput)
    );

    return filtered.slice(0, MAX_VISIBLE_OPTIONS);
  }, []);

  // Single debounced function for filtering options
  const debouncedFilter = useMemo(
    () =>
      debounce(
        async (
          inputValue: string,
          resolve: (options: FieldOption[]) => void,
          fetchFn: () => Promise<FieldOption[]>,
          filterFn: (options: FieldOption[], input: string) => FieldOption[]
        ) => {
          const allOptions = await fetchFn();
          resolve(filterFn(allOptions, inputValue));
        },
        DEBOUNCE_MS
      ),
    []
  );

  // Async options loader for field names with debounce
  const loadFieldNames = useCallback((inputValue: string): Promise<FieldOption[]> => {
    return new Promise((resolve) => {
      if (!inputValue) {
        // No debounce on initial load
        fetchFieldOptions(FilterFieldType.FieldName).then(allOptions => {
          resolve(filterOptions(allOptions, inputValue));
        });
      } else {
        debouncedFilter(
          inputValue,
          resolve,
          () => fetchFieldOptions(FilterFieldType.FieldName),
          filterOptions
        );
      }
    });
  }, [fetchFieldOptions, filterOptions, debouncedFilter]);

  // Async options loader for field values with debounce
  const loadFieldValues = useCallback((inputValue: string): Promise<FieldOption[]> => {
    return new Promise((resolve) => {
      if (!field) {
        resolve([]);
        return;
      }

      if (!inputValue) {
        // No debounce on initial load
        fetchFieldOptions(FilterFieldType.FieldValue).then(allOptions => {
          resolve(filterOptions(allOptions, inputValue));
        });
      } else {
        debouncedFilter(
          inputValue,
          resolve,
          () => fetchFieldOptions(FilterFieldType.FieldValue),
          filterOptions
        );
      }
    });
  }, [fetchFieldOptions, filterOptions, field, debouncedFilter]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedFilter.cancel();
    };
  }, [debouncedFilter]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Label>Filter</Label>
        <IconButton
          name={"times"}
          tooltip={"Remove filter"}
          size="sm"
          onClick={handleRemoveFilter}
        />
      </div>
      <div className={styles.content}>
        <CompatibleAsyncSelect
          placeholder="Select field name"
          value={field ? { label: field, value: field } : null}
          loadOptions={loadFieldNames}
          onChange={handleSelectFieldName}
          isClearable
          allowCustomValue
        />
        <span>:</span>
        <CompatibleAsyncSelect
          key={field}
          placeholder="Select field value"
          value={fieldValue ? { label: fieldValue, value: fieldValue } : null}
          loadOptions={loadFieldValues}
          onChange={handleSelectFieldValue}
          isClearable
          allowCustomValue
        />
      </div>
    </div>
  )
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: grid;
      gap: ${theme.spacing(0.5)};
      width: max-content;
      border: 1px solid ${theme.colors.border.strong};
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1)};
    `,
    header: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
    `,
    content: css`
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${theme.spacing(0.5)};
    `,
  };
};

export default QueryBuilderFieldFilter
