import React, { useMemo } from "react";

import { OperationList, QueryBuilderOperation, QueryBuilderOperationParamEditorProps, VisualQueryModeller } from "@grafana/plugin-ui";

import { VisualQuery } from "../../../../types";
import { createQueryModellerForCategories } from "../QueryModeller";
import { VictoriaLogsQueryOperationCategory } from "../VictoriaLogsQueryOperationCategory";
import { parseStatsOperation } from "../utils/operationParser";
import { splitByUnescapedChar, splitString } from "../utils/stringSplitter";

function isObj(v: unknown): v is { expr: string; visQuery: VisualQuery } {
  return !!v && typeof v === "object" && "expr" in (v as any) && "visQuery" in (v as any);
}

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
  const visQuery = useMemo(() => isObj(value) ? value.visQuery : parseStatsValue(String(value || ""), queryModeller), [value, queryModeller]);

  const queryStatsModeller = useMemo(() => {
    return createQueryModellerForCategories([VictoriaLogsQueryOperationCategory.Stats]);
  }, []);
  const onEditorChange = (query: VisualQuery) => {
    const expr = queryStatsModeller.renderOperations("", query.operations);
    const next = { expr, visQuery: query };
    onChange(index, next as unknown as string);
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

function parseStatsValue(value: string, queryModeller: VisualQueryModeller): VisualQuery {
  let operations: QueryBuilderOperation[] = [];
  if (value !== "") {
    let str = splitString(value);
    for (const commaPart of splitByUnescapedChar(str, ",")) {
      const operation = parseStatsOperation(commaPart, queryModeller);
      if (operation) {
        operations.push(operation.operation);
      }
    }
  }
  return { operations, labels: [], expr: value };
}
