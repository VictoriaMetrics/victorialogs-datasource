import React, { useState } from 'react';

import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { InlineField, Stack, Combobox } from '@grafana/ui';

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
    let value = "";
    if (fromField.trim() === "") {
      value += "\"\"";
    } else {
      value += quoteString(fromField.trim());
    }
    value += " as ";
    if (toField.trim() === "") {
      value += "\"\"";
    } else {
      value += quoteString(toField.trim());
    }
    onChange(index, value);
  };

  return (
    <Stack>
      <InlineField>
        <Combobox<string>
          createCustomValue
          options={()=>getFieldNameOptions(props)}
          onChange={(value) => {
            setFromField(value.value);
            updateValue(value.value, toField);
          }}
          value={fromField}
          width="auto"
          maxWidth={30}
          minWidth={10}
        />
      </InlineField>
      <div style={{ padding: '6px 0 8px 0px' }}>as</div>
      <InlineField>
        <Combobox<string>
          createCustomValue
          options={()=>getFieldNameOptions(props)}
          onChange={(value) => {
            setToField(value.value);
            updateValue(fromField, value.value);
          }}
          value={toField}
          width="auto"
          maxWidth={30}
          minWidth={10}
        />
      </InlineField>
    </Stack>
  );
}
