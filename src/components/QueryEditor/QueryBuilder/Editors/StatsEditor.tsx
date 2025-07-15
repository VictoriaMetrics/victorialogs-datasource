import React, { useMemo } from "react";

import { OperationList, QueryBuilderOperation, QueryBuilderOperationParamEditorProps, VisualQueryModeller } from "@grafana/plugin-ui";

import { VisualQuery } from "../../../../types";
import { buildVisualQueryToString, createQueryModellerForCategories } from "../QueryModeller";
import { VictoriaLogsQueryOperationCategory } from "../VictoriaLogsQueryOperationCategory";
import { parseStatsOperation } from "../utils/operationParser";
import { splitByUnescapedChar, splitString } from "../utils/stringSplitter";

export default function StatsEditor(props: QueryBuilderOperationParamEditorProps) {
  const { value, onChange, index, datasource, timeRange, onRunQuery, queryModeller } = props;
  /*
  value:
  count() logs_total, count_uniq(ip) ips_total
  
       count() if (GET) gets,
       count() if (POST) posts,
       count() if (PUT) puts,
       count() total
  */
  const operations = useMemo(() => parseStatsValue(String(value || ""), queryModeller), [value, queryModeller]);
  const expr = useMemo(() => {
    return buildVisualQueryToString({
      labels: [],
      operations,
      expr: "",
    });
  }, [operations]);
  const visQuery = {
    labels: [],
    operations,
    expr: expr,
  };
  const queryStatsModeller = useMemo(() => {
    return createQueryModellerForCategories([VictoriaLogsQueryOperationCategory.Stats]);
  }, []);
  const onEditorChange = (query: VisualQuery) => {
    const value = queryStatsModeller.renderOperations("", query.operations);
    if (value === undefined) {
      return;
    }
    onChange(index, value);
  }
  return (
    <OperationList
      query={visQuery}
      datasource={datasource}
      timeRange={timeRange}
      onRunQuery={onRunQuery}
      onChange={onEditorChange}
      queryModeller={queryStatsModeller}
    />
  )
}

function parseStatsValue(value: string, queryModeller: VisualQueryModeller) {
  if (value === "") {
    return [];
  }
  let operations: QueryBuilderOperation[] = [];
  let str = splitString(value);
  for (const commaPart of splitByUnescapedChar(str, ",")) {
    const operation = parseStatsOperation(commaPart, queryModeller);
    if (operation) {
      operations.push(operation.operation);
    }
  }
  return operations;
}
