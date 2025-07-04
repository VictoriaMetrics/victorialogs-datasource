import React from 'react';

import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { Combobox } from '@grafana/ui';

import { getFieldNameOptions } from './utils/editorHelper';

export default function ResultFieldEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;
  
  return (
    <Combobox<string>
      createCustomValue
      options={async () => [{ value: "", label: "empty", description: "empty" }, ... (await getFieldNameOptions(props))]}
      onChange={(value) => onChange(index, value.value)}
      value={value as string}
      width="auto"
      maxWidth={30}
      minWidth={10}
    />
  );
}
