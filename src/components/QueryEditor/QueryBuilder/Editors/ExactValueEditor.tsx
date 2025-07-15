import React, { useState } from 'react';

import { QueryBuilderOperationParamEditorProps, toOption } from '@grafana/plugin-ui';
import { InlineField, Select } from '@grafana/ui';

import { getFieldValueOptions } from './utils/editorHelper';

export default function ExactValueEditor(props: QueryBuilderOperationParamEditorProps) {
  const { onChange, index, value, operation } = props;
  const [state, setState] = useState({
    loading: false,
    options: [] as any[],
  });

  return (
    <InlineField>
      <Select<string>
        allowCustomValue={true}
        allowCreateWhileLoading={true}
        isLoading={state.loading}
        onOpenMenu={async () => {
          setState((prev) => ({ ...prev, loading: true }));
          setState({
            loading: false,
            options: await getFieldValueOptions(props, operation.params[0] as string),
          });
        }}
        options={state.options}
        onChange={({ value = "" }) => {
          onChange(index, value);
        }}
        value={toOption(value as string)}
        width="auto"
      />
    </InlineField>
  );
}
