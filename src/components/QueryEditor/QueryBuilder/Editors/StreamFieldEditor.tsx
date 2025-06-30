import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { Stack, MultiSelect, RadioButtonGroup, Combobox, ComboboxOption, InlineField } from '@grafana/ui';

import { FieldHits, FilterFieldType } from "../../../../types";
import { getValue, isValue, quoteString, unquoteString } from '../utils/stringHandler';
import { splitByUnescapedPipe, splitString } from '../utils/stringSplitter';

function parseStreamFilterValue(value: string): { label: string, not_in: boolean, values: string[] } {
  // possible values: {app="nginx"}, {label in (v1,...,vN)}, {label not_in (v1,...,vN)}, {label=~"v1|...|vN"}, {label!~"v1|...|vN"}, {app in ("nginx", "foo.bar")}, {app=~"nginx|foo\\.bar"} // also excaped strings
  if (value === "") {
    return { label: "", not_in: false, values: [] };
  }
  const splitBracket = splitString(value);
  if (splitBracket.length === 0) { // empty
    return { label: "", not_in: false, values: [] };
  }
  let label = "";
  let values: string[] = [];
  const lastElement = splitBracket[splitBracket.length - 1];
  let not_in = false;
  if (lastElement.type === "bracket") { // {app in ("nginx", "test") }
    if (isValue(splitBracket[0])) {
      label = getValue(splitBracket[0]);
    }
    if (splitBracket.length === 2) { // {app in("nginx", "test") }
      not_in = ["not_in", "!~", "!="].includes(lastElement.prefix);
    } else { // {app in ("nginx", "test") }
      not_in = ["not_in", "!~", "!="].includes(splitBracket[1].value as string);
    }
    for (const value of lastElement.value) {
      if (value.value === ",") {
        continue;
      }
      if (isValue(value)) {
        values.push(getValue(value));
      }
    }
  } else { // {app="nginx"}, {label=~"v1|...|vN"}, {app=~"nginx|foo\\.bar"}
    const temp = value.split(/(!=|= ~|!~|=| in | not_in )/);
    label = temp[0].trim();
    const operator = temp[1].trim();
    not_in = ["not_in", "!~", "!="].includes(operator);
    if (operator.includes("~")) {
      const splitPipes = splitByUnescapedPipe(splitString(unquoteString(temp[2].trim())));
      let value = "";
      for (const splitValues of splitPipes) {
        for (const splitValue of splitValues) {
          if (splitValue.type === "colon") {
            value += splitValue.value + ":";
          } else if (splitValue.type === "bracket") {
            value += splitValue.raw_value;
          } else {
            value += splitValue.value;
          }
          values.push(value.replace(/\\(.)/g, "$1"));
          value = "";
        }
      }
    } else {
      const splitValue = splitString(temp[2]);
      if (splitValue.length > 0) {
        if (isValue(splitValue[0])) {
          values = [getValue(splitValue[0])];
        }
      }
    }
  }
  return {
    label,
    not_in,
    values,
  }
}

function buildStreamFilterValue(label: string, values: string[], not_in: boolean): string {
  const operator = not_in ? "!=" : "=";
  values = values.map((value) => quoteString(value));
  if (values.length === 0) {
    return `${label}${operator}`;
  } else if (values.length === 1) {
    return `${label}${operator}${values[0]}`;
  } else {
    const operator = not_in ? "not_in" : "in";
    return `${label} ${operator} (${values.join(",")})`;
  }
}

export default function StreamFieldEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index, datasource, timeRange } = props;

  const initialStreamSelector = parseStreamFilterValue(value as string);
  const [field, setField] = useState<string>(initialStreamSelector.label);
  const [values, setValues] = useState<string[]>(initialStreamSelector.values);
  const [valuesNotIn, setValuesNotIn] = useState<boolean>(initialStreamSelector.not_in);
  const [labelValues, setLabelValues] = useState<SelectableValue[]>([]);

  const updateField = async (newFromField: ComboboxOption<string>) => {
    if (field === newFromField.value) {
      return;
    }
    setField(newFromField.value);
    onChange(index, buildStreamFilterValue(newFromField.value, [], valuesNotIn));
  };

  const updateValues = (rawValues: SelectableValue<string>[]) => {
    const values = rawValues.map((value) => value.value as string);
    setValues(values);
    onChange(index, buildStreamFilterValue(field, values, valuesNotIn));
  };

  return (
    <Stack>
        <Combobox<string>
          options={async () => {
            const streamFieldNames = await datasource.languageProvider?.getFieldList({
              type: FilterFieldType.StreamFieldNames,
              timeRange,
            });
            const options = streamFieldNames.map(({ value, hits }: FieldHits) => ({ 
              value: value,
              label: value || " ",
              description: `hits: ${hits}`,
            }));
            return options;
          }}
          createCustomValue
          value={field}
          onChange={updateField}
          width="auto"
          maxWidth={30}
          minWidth={7}
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
        onOpenMenu={async () => {
          if (field === "") {
            return;
          }
          const streamFieldNames = await datasource.languageProvider?.getFieldList({
            type: FilterFieldType.StreamFieldValues,
            field,
            timeRange,
          });
          const options = streamFieldNames.map(({ value, hits }: FieldHits) => ({ 
            value: value,
            label: value || " ",
            description: `hits: ${hits}`,
          }));
          setLabelValues(options);
        }}
        allowCustomValue
        loadingMessage="Loading labels"
        options={labelValues}
        value={values}
        onChange={updateValues}
      />
      </InlineField>
    </Stack>
  );
}
