import { QueryBuilderOperation, QueryBuilderOperationParamEditorProps, VisualQueryModeller, QueryBuilderLabelFilter } from "@grafana/plugin-ui";
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

function startsWithFilterOperation(labels: QueryBuilderLabelFilter[], operations: QueryBuilderOperation[], queryModeller: VisualQueryModeller) {
  if (labels.length > 0) {
    return true;
  }
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

export async function getFieldOptions(props: QueryBuilderOperationParamEditorProps, fieldType: FilterFieldType, suffixQuery = "", fieldName?: string) {
  if (fieldName === undefined || fieldName.trim() === "") {
    if (fieldType === FilterFieldType.FieldValue || fieldType === FilterFieldType.StreamFieldValues) {
      throw new Error("fieldName is required for FieldValue and StreamFieldValues fieldType");
    }
  }
  const { datasource, timeRange, query, operation, queryModeller } = props;
  const operations = (query as VisualQuery).operations;
  const labels = query.labels;
  const operationIdx = operations.findIndex(op => op === operation);
  const prevOperations = operations.slice(0, (operationIdx === -1) ? operations.length : operationIdx);
  const prevExpr = buildVisualQueryToString({ operations: prevOperations, labels, expr: "" });
  let expr;
  if (prevExpr.trim() !== "" && prevExpr.trim() !== "\"\"") {
    const firstOpIsFilter = startsWithFilterOperation(labels, operations, queryModeller);
    if (!firstOpIsFilter) {
      expr = "_msg:* | ";
    }
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
    options = await datasource.languageProvider?.getFieldList({ query: replacedExpr, timeRange, type: fieldType, field: fieldName });
  } catch (e) {
    console.warn("Error fetching field names", e, "query", replacedExpr);
    options = await datasource.languageProvider?.getFieldList({ timeRange, type: fieldType, field: fieldName });
  }
  options = options.map(({ value, hits }: { value: string; hits: number }) => ({
    value,
    label: value || " ",
    description: `hits: ${hits}`,
  }));
  return [...options, ...await getVariableOptions()];
}

export async function getFieldNameOptions(props: QueryBuilderOperationParamEditorProps) {
  return getFieldOptions(props, FilterFieldType.FieldName);
}

export async function getFieldValueOptions(props: QueryBuilderOperationParamEditorProps, fieldName: string, suffixQuery = "") {
  return getFieldOptions(props, FilterFieldType.FieldValue, suffixQuery, fieldName);
}

export async function getValueTypeOptions(props: QueryBuilderOperationParamEditorProps) {
  const { operation } = props;
  const fieldName = operation.params[0] as string;
  const valueTypeOperations = `uniq by "${fieldName}" | block_stats`;
  return getFieldValueOptions(props, "type", valueTypeOperations);
}
