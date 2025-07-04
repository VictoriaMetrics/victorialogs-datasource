import React from 'react';

import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { Combobox, InlineField } from '@grafana/ui';

import { getFieldNameOptions } from './utils/editorHelper';

export default function FieldEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;
  return (
    <InlineField>
      <Combobox<string>
        createCustomValue
        options={()=>getFieldNameOptions(props)}
        onChange={(value) => {
          onChange(index, value.value)
        }}
        value={value as string}
        width="auto"
        maxWidth={30}
        minWidth={10}
      />
    </InlineField>
  );
}
