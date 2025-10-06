import { css } from "@emotion/css";
import React, { useMemo } from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { OperationList, QueryBuilderOperationParamEditorProps } from "@grafana/plugin-ui";
import { InlineField, useStyles2 } from "@grafana/ui";

import { VisualQuery } from "../../../../types";
import { parseExprToVisualQuery, createQueryModellerWithDefaultField } from "../QueryModeller";
import { VictoriaLogsQueryOperationCategory } from "../VictoriaLogsQueryOperationCategory";

function isObj(v: unknown): v is { expr: string; visQuery: VisualQuery, fieldName: string } {
  return !!v && typeof v === "object" && "expr" in (v as any) && "visQuery" in (v as any) && "fieldName" in (v as any);
}

export default function LogicalFilterEditor(props: QueryBuilderOperationParamEditorProps) {
  const styles = useStyles2(getStyles);
  const { value, onChange, index, datasource, timeRange, onRunQuery, operation } = props;
  const fieldName = operation.params[0] as string;

  const queryModeller = useMemo(() => createQueryModellerWithDefaultField(fieldName, [VictoriaLogsQueryOperationCategory.Filters, VictoriaLogsQueryOperationCategory.Operators]), [fieldName]);

  const valueIsObj = isObj(value);
  const expr = valueIsObj ? value.expr : String(value ?? "");
  const visQuery = valueIsObj ? value.visQuery : parseExprToVisualQuery(expr, fieldName, queryModeller).query;
  const prevFieldsName = valueIsObj ? value.fieldName : fieldName;

  if (prevFieldsName !== fieldName) { // change all defaultFields in the visQuery to the new fieldName
    const oldVisQueryOps = visQuery.operations.map((v) => ({ ...v, disabled: false })); // render all operations even when disabled
    const oldQueryModeller = createQueryModellerWithDefaultField(prevFieldsName, [VictoriaLogsQueryOperationCategory.Filters, VictoriaLogsQueryOperationCategory.Operators]);
    const oldExpr = oldQueryModeller.renderQuery({ operations: oldVisQueryOps }); // old so that old defaultField doesn't get rendered
    const newVisQuery = parseExprToVisualQuery(oldExpr, fieldName, queryModeller).query;
    for (let i = 0; i < visQuery.operations.length; i++) {
      const op = visQuery.operations[i];
      if (op.disabled) {
        newVisQuery.operations[i].disabled = op.disabled; // keep disabled operations disabled
      }
    }
    onChange(index, { expr, visQuery: newVisQuery, fieldName } as unknown as string);
  };

  const onVisQueryChange = (visQuery: VisualQuery) => {
    const expr = queryModeller.renderQuery(visQuery);
    const next = { expr, visQuery, fieldName };
    onChange(index, next as unknown as string);
  };

  return (
    <InlineField>
      <>
        <OperationList
          query={visQuery}
          datasource={datasource}
          onChange={onVisQueryChange}
          timeRange={timeRange}
          onRunQuery={onRunQuery}
          queryModeller={queryModeller}
        />
        <hr />
        <p className={styles.previewText}>
          {expr}
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
