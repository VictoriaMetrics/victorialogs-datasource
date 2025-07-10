import React, { useState } from "react";

import { QueryBuilderOperationParamEditorProps, toOption } from "@grafana/plugin-ui";
import { Input, Select } from "@grafana/ui";

import { quoteString, unquoteString, getValue } from "../utils/stringHandler";
import { SplitString, splitString } from "../utils/stringSplitter";

import { getFieldNameOptions } from "./utils/editorHelper";

export default function MathExprEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;
  const { expr, resultField } = parseMathExprValue(value as string);

  const updateValue = (expr: string, resultField: string) => {
    onChange(index, `${expr} as ${quoteString(resultField)}`);
  }
  const [state, setState] = useState({
    loading: false,
    options: [] as any[],
  });
  return (
    <>
      <Input
        defaultValue={expr}
        onBlur={(e) => { updateValue(e.currentTarget.value, resultField) }}
        placeholder="Enter math expression"
      />
      <div style={{ padding: '6px 0 8px 0px' }}>as</div>
      <Select<string>
        allowCustomValue={true}
        allowCreateWhileLoading={true}
        isLoading={state.loading}
        onOpenMenu={async () => {
          setState((prev) => ({ ...prev, loading: true }));
          setState({
            loading: false,
            options: await getFieldNameOptions(props),
          });
        }}
        options={state.options}
        onChange={(value) => {
          updateValue(expr, value.value as string);
        }}
        value={toOption(resultField)}
        width="auto"
      />
    </>
  )
}

function parseExpr(str: SplitString[]): string {
  if (str.length === 0) {
    return "";
  }
  let expr = "";
  if (str[0].type === "quote") {
    expr = unquoteString(str[0].value);
  } else if (str[0].type === "space") {
    expr = str[0].value;
  } else if (str[0].type === "bracket") {
    expr = str[0].raw_value;
  } else {
    return "";
  }
  str.shift();
  return expr;
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
