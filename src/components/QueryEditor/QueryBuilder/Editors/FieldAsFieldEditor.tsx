import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps, toOption } from '@grafana/plugin-ui';
import { InlineField, Stack, Select } from '@grafana/ui';

import { isValue, quoteString, getValue } from '../utils/stringHandler';
import { splitString } from '../utils/stringSplitter';

import { getFieldNameOptions } from './utils/editorHelper';

export default function FieldAsFieldEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;

  const str = splitString(String(value || ""));
  let parsedFromField = "";
  let parsedToField = "";
  if (str.length === 3) {
    if (isValue(str[0])) {
      parsedFromField = getValue(str[0]);
    }
    if (str[1].type === "space" && str[1].value === "as") {
      if (isValue(str[2])) {
        parsedToField = getValue(str[2]);
      }
    }
  }

  const [fromField, setFromField] = useState<string>(parsedFromField);
  const [toField, setToField] = useState<string>(parsedToField);

  const updateValue = (fromField: string, toField: string) => {
    const parts = [fromField, toField].map(field => {
      const trimmed = field.trim();
      return trimmed === "" ? "\"\"" : quoteString(trimmed);
    });
    const value = parts.join(" as ");
    onChange(index, value);
  };

  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SelectableValue<string>[]>([]);

  const handleOpenMenu = async () => {
    setIsLoading(true);
    setOptions(await getFieldNameOptions(props));
    setIsLoading(false);
  };

  return (
    <Stack>
      <InlineField>
        <Select<string>
          allowCustomValue={true}
          allowCreateWhileLoading={true}
          isLoading={isLoading}
          onOpenMenu={handleOpenMenu}
          options={options}
          onChange={({ value = "" }) => {
            setFromField(value);
            updateValue(value, toField);
          }}
          value={toOption(fromField)}
          width="auto"
        />
      </InlineField>
      <div style={{ padding: '6px 0 8px 0px' }}>as</div>
      <InlineField>
        <Select<string>
          allowCustomValue={true}
          allowCreateWhileLoading={true}
          isLoading={isLoading}
          onOpenMenu={handleOpenMenu}
          options={options}
          onChange={({ value = "" }) => {
            setToField(value);
            updateValue(fromField, value);
          }}
          value={toOption(toField)}
          width="auto"
        />
      </InlineField>
    </Stack>
  );
}
