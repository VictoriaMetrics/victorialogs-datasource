import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { ActionMeta, FormatOptionLabelMeta, MultiSelect } from '@grafana/ui';

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

  const setFields = (newValues: FieldWithPrefix[], action?: ActionMeta) => {
    if (action) {
      if (action.action === "remove-value") {
        newValues = values.filter((v) => v.name !== (action.removedValue as any).name);
      }
    }
    setValues(newValues);
    const newValue = newValues.map((field) => {
      if (field.isPrefix !== undefined) {
        return field.isPrefix ? `${quoteString(field.name)}*` : `${quoteString(field.name)}`;
      }
      return quoteString(field as unknown as string);
    }).join(', ');
    onChange(index, newValue);
  }

  const togglePrefix = (index: number) => {
    const field = values[index];
    field.isPrefix = !field.isPrefix;
    setFields(values);
  };

  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SelectableValue<FieldWithPrefix>[]>([]);

  const formatOptionLabel = (option: SelectableValue<FieldWithPrefix>, { context }: FormatOptionLabelMeta<FieldWithPrefix>) => {
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
  }

  const handleOpenMenu = async () => {
    setIsLoading(true);
    let options = await getFieldNameOptions(props);
    const selectedNames = values.map(v => v.name);
    options = options.filter((opt: SelectableValue<string>) => opt.value && !selectedNames.includes(opt.value));
    setOptions(options as SelectableValue<any>[]);
    setIsLoading(false);
  }

  const handleChange = (values: SelectableValue<FieldWithPrefix>[], action: ActionMeta) => {
    setFields(values.map((v) => v.value || v as FieldWithPrefix), action)
  }

  return (
    <MultiSelect<FieldWithPrefix>
      openMenuOnFocus
      onOpenMenu={handleOpenMenu}
      isLoading={isLoading}
      allowCustomValue
      allowCreateWhileLoading
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      options={options}
      value={values}
      onChange={handleChange}
      formatOptionLabel={formatOptionLabel}
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
    const { type, value: secondValue } = value[1] || {};
    const isPrefix = type === "space" && secondValue === "*";
    return { name: unquoteString(value[0].value), isPrefix };
  }

  const fieldValue = value[0].value;
  const isPrefix = fieldValue.endsWith("*");
  return {
    name: isPrefix ? fieldValue.slice(0, -1) : fieldValue,
    isPrefix,
  };
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
