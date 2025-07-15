import React from "react";

import { QueryBuilderOperationParamEditorProps } from "@grafana/plugin-ui";
import { InlineField } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../../../datasource";
import { QueryBuilderContainer } from "../QueryBuilderContainer";

export default function QueryEditor(props: QueryBuilderOperationParamEditorProps) {
  const { datasource, value, timeRange, onRunQuery, onChange } = props;
  const onVisQueryChange = (update: { expr: string }) => {
    onChange(props.index, update.expr);
  };
  return (
    <InlineField>
      <QueryBuilderContainer
        query={{ expr: value as string }}
        datasource={datasource as VictoriaLogsDatasource}
        onChange={onVisQueryChange}
        onRunQuery={onRunQuery}
        timeRange={timeRange}
      />
    </InlineField>
  )
}
