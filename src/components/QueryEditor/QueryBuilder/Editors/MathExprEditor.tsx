import React, { useState } from "react";

import { SelectableValue } from "@grafana/data";
import { QueryBuilderOperationParamEditorProps, toOption } from "@grafana/plugin-ui";
import { InlineField, Input, Select } from "@grafana/ui";

import { quoteString, getValue } from "../utils/stringHandler";
import { buildSplitString, SplitString, splitString } from "../utils/stringSplitter";

import { getFieldNameOptions } from "./utils/editorHelper";

export default function MathExprEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;
  const { expr, resultField } = parseMathExprValue(String(value || ""));

  const updateValue = (expr: string, resultField: string) => {
    onChange(index, `${expr} as ${quoteString(resultField)}`);
  }
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<SelectableValue<string>[]>([]);

  const handleOpenMenu = async () => {
    setIsLoading(true);
    setOptions(await getFieldNameOptions(props));
    setIsLoading(false);
  }

  return (
    <>
      <Input
        defaultValue={expr}
        onBlur={(e) => { updateValue(e.currentTarget.value, resultField) }}
        placeholder="Enter math expression"
      />
      <div style={{ padding: '6px 0 8px 0px' }}>as</div>
      <InlineField>
        <Select<string>
          allowCustomValue={true}
          allowCreateWhileLoading={true}
          isLoading={isLoading}
          onOpenMenu={handleOpenMenu}
          options={options}
          onChange={({ value = "" }) => updateValue(expr, value)}
          value={toOption(resultField)}
          width="auto"
        />
      </InlineField>
    </>
  )
}

function parseExpr(str: SplitString[]): string {
  if (str.length === 0) {
    return "";
  }
  let token = str[0];
  let i = 0;
  while (i < str.length && (token = str[i])) {
    if (token.type === "space" && token.value === "as") {
      break;
    }
    i++;
  }
  return buildSplitString(str.splice(0, i));
}

function parseMathExprValue(value: string) {
  // expr1 as resultName1
  let str = splitString(value);
  let expr = "";
  let resultField = "";

  if (str.length > 0 && str[0].value !== "as") {
    expr = parseExpr(str);
  }
  if (str.length > 0 && str[0].value === "as") {
    str.shift();
  }
  if (str.length > 0) {
    resultField = getValue(str[0]);
  }
  return { expr, resultField };
}
