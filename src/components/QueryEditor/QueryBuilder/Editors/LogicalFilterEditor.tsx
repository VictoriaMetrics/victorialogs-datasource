import { css } from "@emotion/css";
import React, { useMemo, useState } from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { OperationList, QueryBuilderOperationParamEditorProps } from "@grafana/plugin-ui";
import { InlineField, useStyles2 } from "@grafana/ui";

import { VisualQuery } from "../../../../types";
import { parseExprToVisualQuery, createQueryModellerWithDefaultField } from "../QueryModeller";
import { VictoriaLogsQueryOperationCategory } from "../VictoriaLogsQueryOperationCategory";

export default function LogicalFilterEditor(props: QueryBuilderOperationParamEditorProps) {
  const styles = useStyles2(getStyles);
  const { value, onChange, index, datasource, timeRange, onRunQuery, operation } = props;
  const fieldName = operation.params[0] as string;
  const queryModeller = useMemo(() => createQueryModellerWithDefaultField(fieldName, [VictoriaLogsQueryOperationCategory.Filters, VictoriaLogsQueryOperationCategory.Operators]), [fieldName]);
  const [state, setState] = useState<{ expr: string, visQuery: VisualQuery }>({
    expr: value as string,
    visQuery: parseExprToVisualQuery(value as string, fieldName, queryModeller).query
  })

  const onVisQueryChange = (visQuery: VisualQuery) => {
    const expr = queryModeller.renderQuery(visQuery);
    setState({ expr, visQuery })
    onChange(index, expr);
  };
  return (
    <InlineField>
      <>
        <OperationList
          query={state.visQuery}
          datasource={datasource}
          onChange={onVisQueryChange}
          timeRange={timeRange}
          onRunQuery={onRunQuery}
          queryModeller={queryModeller}
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
