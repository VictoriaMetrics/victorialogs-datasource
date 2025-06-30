import { css } from "@emotion/css";
import { VictoriaLogsDatasource } from "config/vl/victorialogs-datasource/src/datasource";
import React, { useState } from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { QueryBuilderOperationParamEditorProps } from "@grafana/plugin-ui";
import { InlineField, useStyles2 } from "@grafana/ui";

import { VisualQuery } from "../../../../types";
import QueryBuilder from "../QueryBuilder";
import { buildVisualQueryToString, parseExprToVisualQuery } from "../QueryModeller";

export default function QueryEditor(props: QueryBuilderOperationParamEditorProps) {
  const styles = useStyles2(getStyles);
  const { value, onChange, index, datasource, timeRange, onRunQuery } = props;

  const [state, setState] = useState<{ expr: string, visQuery: VisualQuery }>({
    expr: value as string,
    visQuery: parseExprToVisualQuery(value as string).query
  });

  const onVisQueryChange = (visQuery: VisualQuery) => {
    const expr = buildVisualQueryToString(visQuery);
    setState({ expr, visQuery })
    onChange(index, expr);
  };
  return (
    <InlineField>
      <>
        <QueryBuilder
          query={state.visQuery}
          datasource={datasource as VictoriaLogsDatasource}
          onChange={onVisQueryChange}
          onRunQuery={onRunQuery}
          timeRange={timeRange}
        />
        <hr />
        <p className={styles.previewText}>
          {state.expr !== '' && state.expr}
        </p>
      </>
    </InlineField>
  )
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    previewText: css`
      font-size: ${theme.typography.bodySmall.fontSize};
    `
  };
};
