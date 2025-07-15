import React, { useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { QueryBuilderOperationParamEditorProps } from '@grafana/plugin-ui';
import { Stack, MultiSelect, RadioButtonGroup, InlineField, Select } from '@grafana/ui';

import { FieldHits, FilterFieldType } from "../../../../types";
import { getValue, isValue, quoteString } from '../utils/stringHandler';
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
    if (lastElement.prefix === "not_in") {
      not_in = true;
    } else if (splitBracket[1].value === "not_in") {
      not_in = true;
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
    if (isValue(splitBracket[0])) {
      label = getValue(splitBracket[0]);
      let restBracket = splitBracket.slice(1);
      if (splitBracket.length > 0) {
        let is_regex = false;
        if (restBracket[0].value === "!") {
          not_in = true;
          restBracket = restBracket.slice(1);
          if (restBracket.length > 0 && restBracket[0].value === "~") {
            is_regex = true;
          }
          restBracket.shift();
        } else if (restBracket[0].value === "not_in") {
          not_in = true;
          splitBracket.shift();
        } else if (restBracket[0].value === "=") {
          restBracket = restBracket.slice(1);
          if (restBracket.length > 0 && restBracket[0].value === "~") {
            is_regex = true;
            restBracket.shift();
          }
        } else if (restBracket[0].value === "in") {
          restBracket.shift();
        }
        if (restBracket.length > 0) {
          let splitValue = splitString(getValue(restBracket[0]));
          if (is_regex) {
            const splitPipes = splitByUnescapedPipe(splitValue);
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
            if (splitValue.length > 0) {
              if (isValue(splitValue[0])) {
                values = [getValue(splitValue[0])];
              }
            }
          }
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
    return `${quoteString(label)}${operator}`;
  } else if (values.length === 1) {
    return `${quoteString(label)}${operator}${values[0]}`;
  } else {
    const operator = not_in ? "not_in" : "in";
    return `${quoteString(label)} ${operator} (${values.join(",")})`;
  }
}

export default function StreamFieldEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index, datasource, timeRange } = props;

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

  const updateValues = (rawValues: SelectableValue<string>[]) => {
    const values = rawValues.map(({ value = "" }) => value);
    setValues(values);
    onChange(index, buildStreamFilterValue(field, values, valuesNotIn));
  };
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SelectableValue<string>[]>([]);
  return (
    <Stack>
      <Select<string>
        allowCustomValue={true}
        allowCreateWhileLoading={true}
        isLoading={isLoading}
        onOpenMenu={async () => {
          setIsLoading(true);
          const streamFieldNames = await datasource.languageProvider?.getFieldList({
            type: FilterFieldType.StreamFieldNames,
            timeRange,
          });
          const options = streamFieldNames.map(({ value, hits }: FieldHits) => ({
            value: value,
            label: value || " ",
            description: `hits: ${hits}`,
          }));
          setOptions(options);
          setIsLoading(false);
        }}
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
          onOpenMenu={async () => {
            if (field === "") {
              return;
            }
            setIsLoadingLabelValues(true);
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
            setIsLoadingLabelValues(false);
          }}
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
