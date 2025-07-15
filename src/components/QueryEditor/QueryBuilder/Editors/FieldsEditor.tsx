import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { MultiSelect } from '@grafana/ui';

import { getValuesFromBrackets } from '../utils/operationParser';
import { quoteString } from '../utils/stringHandler';
import { splitString } from '../utils/stringSplitter';

import { getFieldNameOptions } from './utils/editorHelper';

export default function FieldsEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;

  const setFields = (values: SelectableValue<string>[]) => {
    const rawValues = values.map(({ value = "" }) => value.trim()).filter(Boolean);
    let value = rawValues.map((v) => quoteString(v)).join(", ");
    onChange(index, value);
  }

  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SelectableValue<string>[]>([]);

  const handleOpenMenu = async () => {
    setIsLoading(true);
    setOptions(await getFieldNameOptions(props));
    setIsLoading(false);
  }

  return (
    <MultiSelect<string>
      onChange={setFields}
      options={options}
      value={getValuesFromBrackets(splitString(String(value || "")))}
      isLoading={isLoading}
      allowCustomValue
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      width={20}
      onOpenMenu={handleOpenMenu}
    />
  );
}
