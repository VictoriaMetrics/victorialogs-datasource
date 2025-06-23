import React from 'react';

import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { Combobox } from '@grafana/ui';

import { getFieldValueOptions } from './utils/editorHelper';

export default function ExactValueEditor(props: QueryBuilderOperationParamEditorProps) {
  const { onChange, index, value, operation } = props;

  return (
    <Combobox<string>
      options={()=> getFieldValueOptions(props, operation.params[0] as string)}
      value={value as string}
      onChange={(v) => onChange(index, v.value)}
      width="auto"
      maxWidth={30}
      minWidth={10}
      createCustomValue
    />
  );
}
