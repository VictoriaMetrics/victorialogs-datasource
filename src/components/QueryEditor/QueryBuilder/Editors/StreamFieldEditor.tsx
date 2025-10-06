import React, { useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { Stack, MultiSelect, RadioButtonGroup, InlineField, Select, ActionMeta } from '@grafana/ui';

import { FilterFieldType } from "../../../../types";
import { getValuesFromBrackets } from '../utils/operationParser';
import { getValue, isValue, quoteString } from '../utils/stringHandler';
import { splitByUnescapedPipe, SplitString, splitString } from '../utils/stringSplitter';

import { getFieldOptions } from './utils/editorHelper';

export function parseNonBraketValue(value: SplitString[]): { label: string, not_in: boolean, values: string[] } {
  let label = getValue(value[0]);
  if (["=", "!", "~"].includes(label)) {
    label = "";
  } else {
    value.shift();
  }
  let is_regex = false;
  let not_in = false;
  let values: string[] = [];
  // get the operator
  if (value[0]) {
    if (value[0].value === "!") {
      not_in = true;
      value = value.slice(1);
      if (value[0]) {
        if (value[0].value === "~") {
          is_regex = true;
          value.shift();
        } else if (value[0].value === "=") {
          value.shift();
        }
      }
    } else if (value[0].value === "not_in") {
      not_in = true;
      value.shift();
    } else if (value[0].value === "=") {
      value = value.slice(1);
      if (value[0] && value[0].value === "~") {
        is_regex = true;
        value.shift();
      }
    } else if (value[0].value === "in") {
      value.shift();
    }
  }
  // get the values
  if (value[0]) {
    const splitValue = splitString(getValue(value[0]));
    if (is_regex) {
      for (const group of splitByUnescapedPipe(splitValue)) {
        let val = "";
        for (const part of group) {
          if (part.type === "colon") {
            val += part.value + ":";
          } else if (part.type === "bracket") {
            val += part.raw_value;
          } else {
            val += part.value;
          }
        }
        values.push(val.replace(/\\(.)/g, "$1"));
      }
    } else if (splitValue.length && isValue(splitValue[0])) {
      values = [getValue(splitValue[0])];
    }
  }
  return { label, not_in, values };
}

export function parseStreamFilterValue(value: string): { label: string, not_in: boolean, values: string[] } {
  // possible values: {app="nginx"}, {label in (v1,...,vN)}, {label not_in (v1,...,vN)}, {label=~"v1|...|vN"}, {label!~"v1|...|vN"}, {app in ("nginx", "foo.bar")}, {app=~"nginx|foo\\.bar"}
  if (!value) {
    return { label: "", not_in: false, values: [] };
  }
  const splitBracket = splitString(value);
  if (!splitBracket.length) {
    return { label: "", not_in: false, values: [] };
  }
  let label = "";
  if (isValue(splitBracket[0])) {
    label = getValue(splitBracket[0]);
  }
  // Bracket case: {label in (...)} or {label not_in (...)}
  const last = splitBracket[splitBracket.length - 1];
  if (last.type === "bracket") {
    const not_in = last.prefix === "not_in" || (splitBracket[1] && splitBracket[1].value === "not_in");
    const values = getValuesFromBrackets(last.value);
    return { label, not_in, values };
  }
  // Non-bracket case: {label=...}, {label=~...}, {label!~...}, etc.
  if (isValue(splitBracket[0])) {
    return parseNonBraketValue(splitBracket);
  }
  return { label, not_in: false, values: [] };
}

function buildStreamFilterValue(label: string, values: string[], not_in: boolean): string {
  const operator = not_in ? "!=" : "=";
  values = values.map((value) => quoteString(value));
  if (values.length === 0) {
    return `${quoteString(label)}${operator}`;
  } else if (values.length === 1) {
    return `${quoteString(label)}${operator}${values[0]}`;
  } else {
    const operator = not_in ? "not_in" : "in";
    return `${quoteString(label)} ${operator} (${values.join(",")})`;
  }
}

export default function StreamFieldEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;

  const initialStreamSelector = parseStreamFilterValue(String(value || ""));
  const [field, setField] = useState<string>(initialStreamSelector.label);
  const [values, setValues] = useState<string[]>(initialStreamSelector.values);
  const [valuesNotIn, setValuesNotIn] = useState<boolean>(initialStreamSelector.not_in);
  const [isLoadingLabelValues, setIsLoadingLabelValues] = useState(false);
  const [labelValues, setLabelValues] = useState<SelectableValue[]>([]);

  const updateField = async ({ value = "" }) => {
    if (field === value) {
      return;
    }
    setField(value);
    onChange(index, buildStreamFilterValue(value, [], valuesNotIn));
  };

  const updateValues = (rawValues: SelectableValue<string>[], action: ActionMeta) => {
    let newValues = rawValues.map(({ value = "" }) => value);
    if (action) {
      if (action.action === "remove-value") {
        newValues = values.filter((v) => v !== (action.removedValue as SelectableValue<string>).value);
      }
    }
    setValues(newValues);
    onChange(index, buildStreamFilterValue(field, newValues, valuesNotIn));
  };
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SelectableValue<string>[]>([]);

  const handleOpenNamesMenu = async () => {
    setIsLoading(true);
    const options = await getFieldOptions(props, FilterFieldType.StreamFieldNames);
    setOptions(options);
    setIsLoading(false);
  }

  const handleOpenValuesMenu = async () => {
    if (field === "") {
      return;
    }
    setIsLoadingLabelValues(true);
    const options = await getFieldOptions(props, FilterFieldType.StreamFieldValues, "", field);
    setLabelValues(options);
    setIsLoadingLabelValues(false);
  }

  return (
    <Stack>
      <Select<string>
        allowCustomValue={true}
        allowCreateWhileLoading={true}
        isLoading={isLoading}
        onOpenMenu={handleOpenNamesMenu}
        options={options}
        onChange={updateField}
        value={toOption(field)}
        width="auto"
      />
      <div style={{ padding: '6px 0 8px 0px', display: 'flex', alignItems: 'center' }}>
        <RadioButtonGroup
          options={[
            { label: 'in', value: false },
            { label: 'not in', value: true },
          ]}
          value={valuesNotIn}
          onChange={(value) => {
            onChange(index, buildStreamFilterValue(field, values, value));
            setValuesNotIn(value);
          }}
          size="sm"
        />
      </div>
      <InlineField>
        <MultiSelect<string>
          openMenuOnFocus
          onOpenMenu={handleOpenValuesMenu}
          isLoading={isLoadingLabelValues}
          allowCustomValue
          allowCreateWhileLoading
          loadingMessage="Loading labels"
          options={labelValues}
          value={values}
          onChange={updateValues}
        />
      </InlineField>
    </Stack>
  );
}
