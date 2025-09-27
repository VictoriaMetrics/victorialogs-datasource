import { QueryBuilderOperation, QueryBuilderOperationParamEditorProps, VisualQueryModeller } from "@grafana/plugin-ui";
import { getTemplateSrv } from "@grafana/runtime";

import { VictoriaLogsDatasource } from "../../../../../datasource";
import { FilterFieldType, VisualQuery } from "../../../../../types";
import { buildVisualQueryToString } from "../../QueryModeller";
import { VictoriaLogsQueryOperationCategory } from "../../VictoriaLogsQueryOperationCategory";

export async function getVariableOptions() {
  return getTemplateSrv().getVariables().map((v: any) => ({
    value: "$" + v.name,
    label: "$" + v.name,
    description: 'variable',
  }));
}

function startsWithFilterOperation(operations: QueryBuilderOperation[], queryModeller: VisualQueryModeller) {
  if (operations.length === 0) {
    return false;
  }
  const firstOp = operations[0];
  const operation = queryModeller.getOperationDefinition(firstOp.id);
  if (!operation) {
    return false;
  }
  if ([VictoriaLogsQueryOperationCategory.Filters, VictoriaLogsQueryOperationCategory.Operators, VictoriaLogsQueryOperationCategory.Special].includes(operation.category as VictoriaLogsQueryOperationCategory)) {
    return true;
  }
  return false
}

export async function getFieldNameOptions(props: QueryBuilderOperationParamEditorProps) {
  const { datasource, timeRange, queryModeller, query, operation } = props;
  const operations = (query as VisualQuery).operations;
  const operationIdx = operations.findIndex(op => op === operation);
  const prevOperations = operations.slice(0, (operationIdx === -1) ? operations.length : operationIdx);
  const prevExpr = buildVisualQueryToString({ operations: prevOperations, labels: [], expr: "" });
  let expr = "";
  if (prevExpr.trim() !== "" && prevExpr.trim() !== "\"\"") {
    const firstOpIsFilter = startsWithFilterOperation(operations, queryModeller);
    if (!firstOpIsFilter) {
      expr = "_msg:* | ";
    }
    expr += prevExpr;
  } else {
    expr = "_msg:*";
  }
  const replacedExpr = (datasource as VictoriaLogsDatasource).interpolateString(expr);
  let options = [];
  try {
    options = await datasource.languageProvider?.getFieldList({ query: replacedExpr, timeRange, type: FilterFieldType.FieldName });
  } catch (e) {
    console.warn("Error fetching field names", e, "query", replacedExpr);
    options = await datasource.languageProvider?.getFieldList({ timeRange, type: FilterFieldType.FieldName });
  }
  options = options.map(({ value, hits }: { value: string; hits: number }) => ({
    value,
    label: value || " ",
    description: `hits: ${hits}`,
  }));
  return [...options, ...await getVariableOptions()];
}

export async function getFieldValueOptions(props: QueryBuilderOperationParamEditorProps, fieldName: string, suffixQuery = "") {
  const { datasource, timeRange, query, operation } = props;
  const operations = (query as VisualQuery).operations;
  const operationIdx = operations.findIndex(op => op === operation);
  const prevOperations = operations.slice(0, operationIdx);
  const prevExpr = buildVisualQueryToString({ operations: prevOperations, labels: [], expr: "" });
  let expr;
  if (prevExpr.trim() !== "") {
    expr = prevExpr;
  } else {
    expr = "_msg:*";
  }
  if (suffixQuery.trim() !== "") {
    expr += " | " + suffixQuery;
  }
  const replacedExpr = (datasource as VictoriaLogsDatasource).interpolateString(expr);
  let options = [];
  try {
    options = await datasource.languageProvider?.getFieldList({ query: replacedExpr, timeRange, type: FilterFieldType.FieldValue, field: fieldName });
  } catch (e) {
    console.warn("Error fetching field names", e, "query", replacedExpr);
    options = await datasource.languageProvider?.getFieldList({ timeRange, type: FilterFieldType.FieldValue, field: fieldName });
  }
  options = options.map(({ value, hits }: { value: string; hits: number }) => ({
    value,
    label: value || " ",
    description: `hits: ${hits}`,
  }));
  return [...options, ...await getVariableOptions()];
}

export async function getValueTypeOptions(props: QueryBuilderOperationParamEditorProps) {
  const { operation } = props;
  const fieldName = operation.params[0] as string;
  const valueTypeOperations = `uniq by "${fieldName}" | block_stats`;
  return getFieldValueOptions(props, "type", valueTypeOperations);
}
