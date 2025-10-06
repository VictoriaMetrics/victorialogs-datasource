import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps, toOption } from '@grafana/plugin-ui';
import { InlineField, Select } from '@grafana/ui';

import { getFieldNameOptions } from './utils/editorHelper';

export default function FieldEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SelectableValue<string>[]>([]);

  const handleOpenMenu = async () => {
    setIsLoading(true);
    setOptions(await getFieldNameOptions(props));
    setIsLoading(false);
  }

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
