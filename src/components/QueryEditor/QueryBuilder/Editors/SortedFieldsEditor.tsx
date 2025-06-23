import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { Icon, MultiSelect } from '@grafana/ui';

import { quoteString, unquoteString } from '../utils/stringHandler';
import { splitByUnescapedChar, SplitString, splitString } from '../utils/stringSplitter';

import { getFieldNameOptions } from './utils/editorHelper';

interface FieldWithDirection {
  name: string;
  isDesc: boolean;
}

export default function SortedFieldsEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;

  const str = splitString(value as string);
  const parsedValues = parseInputValues(str);
  const [values, setValues] = useState<FieldWithDirection[]>(parsedValues);

  const setFields = (values: FieldWithDirection[]) => {
    setValues(values);
    const newValue = values.map((field) => {
      return field.isDesc ? `${quoteString(field.name)} desc` : `${quoteString(field.name)}`;
    }).join(', ');
    onChange(index, newValue);
  }

  const toggleDirection = (index: number) => {
    const field = values[index];
    field.isDesc = !field.isDesc;
    setFields(values);
  };

  const [state, setState] = useState<{
    options?: SelectableValue<FieldWithDirection>[];
    isLoading?: boolean;
  }>({});

  return (
    <MultiSelect<FieldWithDirection>
      openMenuOnFocus
      onOpenMenu={async () => {
        setState({ isLoading: true });
        let options = await getFieldNameOptions(props);
        const selectedNames = values.map(v => v.name);
        options = options.filter((opt: SelectableValue<FieldWithDirection>) => opt.value && !selectedNames.includes(opt.value.name));
        setState({ options, isLoading: undefined });
      }}
      isLoading={state.isLoading}
      allowCustomValue
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      options={state.options}
      value={values}
      onChange={(values) => setFields(values.map((v) => v.value || v as FieldWithDirection))}
      formatOptionLabel={(option, { context }) => {
        if (context === 'value') {
          const field = option as FieldWithDirection;
          const handleToggle = (e: React.SyntheticEvent) => {
            e.stopPropagation();
            const idx = values.findIndex((v) => (v).name === field.name);
            if (idx !== -1) {
              toggleDirection(idx);
            }
          };
          return (
            <span
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onMouseDown={handleToggle}
              title={field.isDesc ? 'Sorting descending' : 'Sorting ascending'}
            >
              {formatFieldLabel(field)}
              <Icon
                name={field.isDesc ? 'arrow-down' : 'arrow-up'}
                style={{ marginLeft: '4px', verticalAlign: 'middle' }}
              />
            </span>
          );
        }
        return <>{option.label}</>;
      }}
    />
  );
}

const formatFieldLabel = (field: FieldWithDirection): string => {
  return field.isDesc ? `${field.name} (desc)` : field.name;
};

const parseInputValues = (str: SplitString[]): FieldWithDirection[] => {
  let fields: FieldWithDirection[] = [];
  for (const field of splitByUnescapedChar(str, ',')) {
    if (field.length === 2 && field[1].type === "space" && field[0].type !== "bracket") {
      let fieldName = "";
      if (field[0].type === "quote") {
        fieldName = unquoteString(field[0].value);
      } else {
        fieldName = field[0].value;
      }
      const isDesc = field[1].value.toLowerCase() === 'desc';
      fields.push({ name: fieldName, isDesc });
    } else if (field.length === 1) {
      if (field[0].type === "space") {
        fields.push({ name: field[0].value, isDesc: false });
      } else if (field[0].type === "quote") {
        const fieldName = unquoteString(field[0].value);
        fields.push({ name: fieldName, isDesc: false });
      }
    }
  }
  return fields;
};
