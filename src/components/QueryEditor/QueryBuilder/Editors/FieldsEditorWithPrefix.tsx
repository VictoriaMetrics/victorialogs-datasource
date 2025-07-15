import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { MultiSelect } from '@grafana/ui';

import { quoteString, unquoteString } from '../utils/stringHandler';
import { splitByUnescapedChar, SplitString, splitString } from '../utils/stringSplitter';

import { getFieldNameOptions } from './utils/editorHelper';

interface FieldWithPrefix {
  name: string;
  isPrefix: boolean;
}

export default function FieldsEditorWithPrefix(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;

  const str = splitString(String(value || ""));
  const parsedValues = parseInputValues(str);
  const [values, setValues] = useState<FieldWithPrefix[]>(parsedValues);

  const setFields = (values: FieldWithPrefix[]) => {
    setValues(values);
    const newValue = values.map((field) => {
      if (field.isPrefix !== undefined) {
        return field.isPrefix ? `${quoteString(field.name)}*` : `${quoteString(field.name)}`;
      } else {
        return quoteString(field as unknown as string);
      }
    }).join(', ');
    onChange(index, newValue);
  }

  const togglePrefix = (index: number) => {
    const field = values[index];
    field.isPrefix = !field.isPrefix;
    setFields(values);
  };

  const [state, setState] = useState<{
    options?: SelectableValue<FieldWithPrefix>[];
    isLoading?: boolean;
  }>({});

  return (
    <MultiSelect<FieldWithPrefix>
      openMenuOnFocus
      onOpenMenu={async () => {
        setState({ isLoading: true });
        let options = await getFieldNameOptions(props);
        const selectedNames = values.map(v => v.name);
        options = options.filter((opt: SelectableValue<string>) => opt.value && !selectedNames.includes(opt.value));
        setState({ options, isLoading: undefined });
      }}
      isLoading={state.isLoading}
      allowCustomValue
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      options={state.options}
      value={values}
      onChange={(values) => setFields(values.map((v) => v.value || v as FieldWithPrefix))}
      formatOptionLabel={(option, { context }) => {
        if (context === 'value') {
          const field = option as FieldWithPrefix;
          const handleToggle = (e: React.SyntheticEvent) => {
            e.stopPropagation();
            const idx = values.findIndex((v) => (v).name === field.name);
            if (idx !== -1) {
              togglePrefix(idx);
            }
          };
          return (
            <span
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onMouseDown={handleToggle}
            >
              {formatFieldLabel(field)}
            </span>
          );
        }
        return <>{option.label}</>;
      }}
    />
  );
}

const formatFieldLabel = (field: FieldWithPrefix): string => {
  return field.isPrefix ? `${field.name} *` : field.name;
};

const parseValue = (value: SplitString[]): FieldWithPrefix => {
  if (value.length === 0 || value[0].type === "bracket") {
    return { name: '', isPrefix: false };
  }
  if (value[0].type === "quote") {
    let isPrefix = false;
    if (value.length > 1) {
      isPrefix = (value[1].type === "space" && value[1].value === "*");
    }
    return { name: unquoteString(value[0].value), isPrefix };
  } else {
    let fieldValue = value[0].value;
    if (fieldValue.endsWith('*')) {
      return { name: fieldValue.slice(0, -1), isPrefix: true };
    }
    return { name: fieldValue, isPrefix: false };
  }
}

const parseInputValues = (str: SplitString[]): FieldWithPrefix[] => {
  let fields: FieldWithPrefix[] = [];
  for (const field of splitByUnescapedChar(str, ',')) {
    if (field.length > 0 && field[0].type !== "bracket") {
      fields.push(parseValue(field));
    }
  }
  return fields;
};
