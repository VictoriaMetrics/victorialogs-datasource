import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps, toOption } from '@grafana/plugin-ui';
import { InlineField, Select } from '@grafana/ui';

import { getFieldValueOptions } from './utils/editorHelper';

export default function ExactValueEditor(props: QueryBuilderOperationParamEditorProps) {
  const { onChange, index, value, operation } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SelectableValue<string>[]>([]);
  const handleOpenMenu = async () => {
    setIsLoading(true);
    setOptions(await getFieldValueOptions(props, operation.params[0] as string));
    setIsLoading(false);
  };
  return (
    <InlineField>
      <Select<string>
        allowCustomValue={true}
        allowCreateWhileLoading={true}
        isLoading={isLoading}
        onOpenMenu={handleOpenMenu}
        options={options}
        onChange={({ value = "" }) => onChange(index, value)}
        value={toOption(String(value || ""))}
        width="auto"
      />
    </InlineField>
  );
}
