import { debounce } from "lodash";
import React, { FormEvent, useEffect, useState } from 'react';

import { DEFAULT_FIELD_DISPLAY_VALUES_LIMIT, QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../datasource";
import { FilterFieldType, Options, Query, VariableQuery } from '../../types';

const variableOptions = [
  { label: 'Field names', value: FilterFieldType.FieldName },
  { label: 'Field values', value: FilterFieldType.FieldValue },
];

const refId = 'VictoriaLogsVariableQueryEditor-VariableQuery'

export type Props = QueryEditorProps<VictoriaLogsDatasource, Query, Options, VariableQuery>;

export const VariableQueryEditor = ({ onChange, query, datasource, range }: Props) => {
  const [type, setType] = useState<FilterFieldType>();
  const [queryFilter, setQueryFilter] = useState<string>('');
  const [field, setField] = useState<string>('');
  const [limit, setLimit] = useState<number>(DEFAULT_FIELD_DISPLAY_VALUES_LIMIT);
  const [fieldNames, setFieldNames] = useState<SelectableValue<string>[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleTypeChange = (newType: SelectableValue<FilterFieldType>) => {
    if (!newType.value) {
      return;
    }
    setType(newType.value);
    onChange({ refId, type: newType.value, field, query: queryFilter });
  };

  const handleFieldChange = (newField: SelectableValue<string>) => {
    setField(newField.value || "");
  }

  const handleBlur = () => {
    if (!type) {
      return;
    }
    onChange({ refId, type, field, query: queryFilter, limit });
  };

  const handleQueryFilterChange = (e: FormEvent<HTMLInputElement>) => {
    setQueryFilter(e.currentTarget.value);
  };

  const handleLimitChange = (e: FormEvent<HTMLInputElement>) => {
    const value = Number(e.currentTarget.value)
    setLimit(isNaN(value) ? DEFAULT_FIELD_DISPLAY_VALUES_LIMIT : value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.key === 'Enter' && handleBlur()
  }

  useEffect(() => {
    if (!query) {
      return;
    }

    setType(query.type);
    setField(query.field || '');
    setQueryFilter(query.query || '');
    setLimit(query.limit ?? DEFAULT_FIELD_DISPLAY_VALUES_LIMIT);
  }, [query]);

  useEffect(() => {
    if (type !== FilterFieldType.FieldValue) {
      return;
    }

    const getFiledNames = async () => {
      try {
        setError("");
        setIsLoading(true);
        const list = await datasource.languageProvider?.getFieldList({
          type: FilterFieldType.FieldName,
          timeRange: range,
          limit,
          query: datasource.interpolateString(queryFilter),
        }, datasource.customQueryParameters);

        const result = list
          ? list.map(({ value, hits }) => ({
            value,
            label: value || " ",
            description: `hits: ${hits}`,
          }))
          : [];

        setFieldNames(result);
      } catch (error) {
        setError("Error fetching field names. See console for more details.");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    const debouncedGetFieldNames = debounce(getFiledNames, 1000);

    debouncedGetFieldNames();

    return () => {
      debouncedGetFieldNames.cancel();
      setIsLoading(false);
    };
  }, [datasource, type, range, limit, queryFilter]);

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Query type" labelWidth={20}>
          <Select
            aria-label="Query type"
            onChange={handleTypeChange}
            onBlur={handleBlur}
            value={type}
            options={variableOptions}
            width={20}
          />
        </InlineField>
        {type === FilterFieldType.FieldValue && (
          <InlineField
            label="Field"
            labelWidth={20}
            error={error}
            invalid={!!error}
          >
            <Select
              aria-label="Field value"
              onChange={handleFieldChange}
              onBlur={handleBlur}
              value={field}
              options={fieldNames}
              width={20}
              isLoading={isLoading}
            />
          </InlineField>
        )}
        <InlineField
          label="Limit"
          labelWidth={20}
          tooltip={'Maximum number of values to return. Set to 0 to remove the limit.'}
        >
          <Input
            type="number"
            aria-label="Limit"
            placeholder="Limit"
            value={limit}
            onChange={handleLimitChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Query"
          labelWidth={20}
          grow={true}
          tooltip={'Optional. If defined, this filters the logs based on the specified query and returns the corresponding field names.'}
        >
          <Input
            type="text"
            aria-label="Query Filter"
            placeholder="Optional query filter"
            value={queryFilter}
            onChange={handleQueryFilterChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  )
};
