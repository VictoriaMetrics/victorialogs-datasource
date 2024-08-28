import React, { FormEvent, useEffect, useState } from 'react';
import { usePrevious } from 'react-use';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../datasource";
import { FilterFieldType, Options, Query, VariableQuery } from '../../types';

const variableOptions = [
  { label: 'Field names', value: FilterFieldType.Name },
  { label: 'Field values', value: FilterFieldType.Value },
];

const refId = 'VictoriaLogsVariableQueryEditor-VariableQuery'

export type Props = QueryEditorProps<VictoriaLogsDatasource, Query, Options, VariableQuery>;

export const VariableQueryEditor = ({ onChange, query, datasource, range }: Props) => {
  const [type, setType] = useState<FilterFieldType>();
  const [queryFilter, setQueryFilter] = useState<string>('');
  const [field, setField] = useState<string>('');
  const [fieldNames, setFieldNames] = useState<SelectableValue<string>[]>([])

  const previousType = usePrevious(type);

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
    onChange({ refId, type, field, query: queryFilter });
  };

  const handleQueryFilterChange = (e: FormEvent<HTMLInputElement>) => {
    setQueryFilter(e.currentTarget.value);
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
  }, [query]);

  useEffect(() => {
    if (type !== FilterFieldType.Value || previousType === type) {
      return;
    }

    const getFiledNames = async () => {
      const list = await datasource.languageProvider?.getFieldList({ type: FilterFieldType.Name, timeRange: range })
      const result = list ? list.map(({ value, hits }) => ({
        value,
        label: value || " ",
        description: `hits: ${hits}`,
      })) : []
      setFieldNames(result)
    }

    getFiledNames().catch(console.error)
  }, [datasource, type, range, previousType]);

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
        {type === FilterFieldType.Value && (
            <InlineField label="Field" labelWidth={20}>
              <Select
                aria-label="Field value"
                onChange={handleFieldChange}
                onBlur={handleBlur}
                value={field}
                options={fieldNames}
                width={20}
              />
            </InlineField>
          )}
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
