import React, { useState } from "react";

import { QueryBuilderOperationParamEditorProps, toOption } from "@grafana/plugin-ui";
import { Select } from "@grafana/ui";

import { getVariableOptions } from "./utils/editorHelper";

export default function VariableEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index } = props;
  const [state, setState] = useState({
    loading: false,
    options: [] as any[],
  });

  return (
    <Select<string>
      allowCustomValue={true}
      allowCreateWhileLoading={true}
      isLoading={state.loading}
      onOpenMenu={async () => {
        setState((prev) => ({ ...prev, loading: true }));
        setState({
          loading: false,
          options: await getVariableOptions(),
        });
      }}
      options={state.options}
      onChange={({ value = "" }) => {
        onChange(index, value);
      }}
      value={toOption(value as string)}
      width="auto"
    />
  );
}
