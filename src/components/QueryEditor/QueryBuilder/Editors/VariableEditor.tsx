import React from "react";

import { QueryBuilderOperationParamEditorProps, QueryBuilderOperationParamValue } from "@grafana/plugin-ui";
import { Combobox } from "@grafana/ui";

import { getVariableOptions } from "./utils/editorHelper";

export default function VariableEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;

  return (
    <Combobox<string>
      options={getVariableOptions}
      value={value as string}
      onChange={(value) => onChange(index, value.value as QueryBuilderOperationParamValue)}
      minWidth={10}
      width="auto"
    />
  );
}
