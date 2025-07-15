import React, { useState } from 'react';

import { QueryBuilderOperationParamEditorProps, toOption } from '@grafana/plugin-ui';
import { InlineField, Stack, Select } from '@grafana/ui';

import { isValue, quoteString, getValue } from '../utils/stringHandler';
import { splitString } from '../utils/stringSplitter';

import { getFieldNameOptions } from './utils/editorHelper';

export default function FieldAsFieldEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;

  const str = splitString(value as string);
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

  const [state, setState] = useState({
    loading: false,
    options: [] as any[],
  });

  const handleOpenMenu = async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const options = await getFieldNameOptions(props);
    setState({
      loading: false,
      options,
    });
  };

  return (
    <Stack>
      <InlineField>
        <Select<string>
          allowCustomValue={true}
          allowCreateWhileLoading={true}
          isLoading={state.loading}
          onOpenMenu={handleOpenMenu}
          options={state.options}
          onChange={(value) => {
            setFromField(value.value as string);
            updateValue(value.value as string, toField);
          }}
          value={toOption(fromField as string)}
          width="auto"
        />
      </InlineField>
      <div style={{ padding: '6px 0 8px 0px' }}>as</div>
      <InlineField>
        <Select<string>
          allowCustomValue={true}
          allowCreateWhileLoading={true}
          isLoading={state.loading}
          onOpenMenu={handleOpenMenu}
          options={state.options}
          onChange={(value) => {
            setToField(value.value as string);
            updateValue(fromField, value.value as string);
          }}
          value={toOption(toField as string)}
          width="auto"
        />
      </InlineField>
    </Stack>
  );
}
