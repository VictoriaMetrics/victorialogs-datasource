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
    const rawValues = values.map((v) => v.value?.trim()).filter((v) => v !== undefined && v !== null);
    let value = rawValues.map((v)=> quoteString(v)).join(", ");
    onChange(index, value);
  }

  const [state, setState] = useState<{
    options?: SelectableValue[];
    isLoading?: boolean;
  }>({});

  const handleOpenMenu = async () => {
    setState({ isLoading: true });
    const options = await getFieldNameOptions(props);
    setState({ options, isLoading: undefined });
  }

  return (
    <MultiSelect<string>
      onChange={setFields}
      options={state.options}
      value={getValuesFromBrackets(splitString(value as string))}
      isLoading={state.isLoading}
      allowCustomValue
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      width={20}
      onOpenMenu={handleOpenMenu}
    />
  );
}
