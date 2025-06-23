import { QueryBuilderOperationParamEditorProps } from "@grafana/plugin-ui";
import { getTemplateSrv } from "@grafana/runtime";

import { VictoriaLogsDatasource } from "../../../../../datasource";
import { FilterFieldType, VisualQuery } from "../../../../../types";

export async function getVariableOptions() {
  return getTemplateSrv().getVariables().map((v: any) => ({
    value: "$" + v.name,
    description: 'variable',
  }));
}

export async function getFieldNameOptions(props: QueryBuilderOperationParamEditorProps) {
  const { datasource, timeRange, queryModeller, query, operation } = props;
  const operations = (query as VisualQuery).operations;
  const operationIdx = operations.findIndex(op => op === operation);
  const prevOperations = operations.slice(0, operationIdx);
  const prevExpr = queryModeller.renderQuery({ operations: prevOperations, labels: [] });
  let expr;
  if (prevExpr.trim() !== "") {
    expr = prevExpr;
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
  const { datasource, timeRange, queryModeller, query, operation } = props;
  const operations = (query as VisualQuery).operations;
  const operationIdx = operations.findIndex(op => op === operation);
  const prevOperations = operations.slice(0, operationIdx);
  const prevExpr = queryModeller.renderQuery({ operations: prevOperations, labels: [] });
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
    console.log("Fetching field names for query \"", replacedExpr, "\"");
    options = await datasource.languageProvider?.getFieldList({ query: replacedExpr, timeRange, type: FilterFieldType.FieldValue, field: fieldName });
  } catch (e) {
    console.warn("Error fetching field names", e, "query", replacedExpr);
    options = await datasource.languageProvider?.getFieldList({ timeRange, type: FilterFieldType.FieldValue, field: fieldName });
  }
  console.log(options);
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
  return getFieldValueOptions(props, "type",valueTypeOperations);
}
