import { AdHocVariableFilter } from '@grafana/data';
import { QueryBuilderOperation } from "@grafana/plugin-ui";

import { VictoriaLogsOperationId } from "./components/QueryEditor/QueryBuilder/Operations";
import { buildVisualQueryToString, parseExprToVisualQuery } from "./components/QueryEditor/QueryBuilder/QueryModeller";
import { quoteString } from './components/QueryEditor/QueryBuilder/utils/stringHandler';
import { LABEL_STREAM_ID } from "./datasource";

const operators = ["=", "!=", "=~", "!~", "<", ">"];
const streamKeys = ["_stream", "_stream_id"];

export function queryHasFilter(query: string, key: string, value: string, operator?: string): boolean {
  const applicableOperators = operator ? [operator] : operators;
  return applicableOperators.some(op => query.includes(getFilterInsertValue(key, value, op)));
}

const getFilterInsertValue = (key: string, value: string, operator: string): string => {
  if (streamKeys.includes(key)) {
    return getFilterInsertValueForStream(key, value, operator);
  }

  switch (operator) {
    case "=~":
      return `${key}:~"${value}"`
    default:
      return `${key}:${operator}"${value}"`
  }
}

const getFilterInsertValueForStream = (key: string, value: string, operator: string): string => {
  if (operator.includes('!')) {
    return `(! ${key}: ${value})`;
  }

  return `${key}:${value}`;
}

const valueOperations = [
  VictoriaLogsOperationId.MultiExact,
  VictoriaLogsOperationId.Exact,
  VictoriaLogsOperationId.Regexp,
  VictoriaLogsOperationId.RangeComparison,
  VictoriaLogsOperationId.StreamId,
  VictoriaLogsOperationId.Stream,
]

type ValueOperationType = (typeof valueOperations)[number];

function getType(operator: string, key: string): ValueOperationType
function getType(operator: string | undefined, key: string): ValueOperationType | typeof valueOperations
function getType(operator: string | undefined, key: string): ValueOperationType | typeof valueOperations {
  if (key === LABEL_STREAM_ID) {
    return VictoriaLogsOperationId.StreamId;
  } else if (key === "_stream") { // can't merge two stream values
    return VictoriaLogsOperationId.Stream;
  }
  if (!operator) {
    return valueOperations;
  }
  if (operator.endsWith("|")) { // !=| or =|
    return VictoriaLogsOperationId.MultiExact;
  } else if (operator.endsWith("=")) {
    return VictoriaLogsOperationId.Exact;
  } else if (operator.endsWith("~")) {
    return VictoriaLogsOperationId.Regexp;
  } else if (operator === "<" || operator === ">") {
    return VictoriaLogsOperationId.RangeComparison;
  } else {
    throw new Error(`Unsupported operator: ${operator}`);
  }
}

export const addLabelToQuery = (query: string, filter: AdHocVariableFilter): string => {
  const { key, value, values = [], operator } = filter;
  const type = getType(operator, key);
  const visQuery = parseExprToVisualQuery(query).query;
  if (type === VictoriaLogsOperationId.Exact) {
    const notEqual = operator === "!=";
    visQuery.operations.push({
      id: VictoriaLogsOperationId.Exact,
      params: [key, value, notEqual, false, false],
    });
  } else if (type === VictoriaLogsOperationId.Regexp) {
    const notEqual = operator === "!~";
    if (notEqual) {
      visQuery.operations.push({
        id: VictoriaLogsOperationId.NOT,
        params: [],
      });
    }
    visQuery.operations.push({
      id: VictoriaLogsOperationId.Regexp,
      params: [key, value, false],
    });
  } else if (type === VictoriaLogsOperationId.RangeComparison) {
    visQuery.operations.push({
      id: VictoriaLogsOperationId.RangeComparison,
      params: [key, operator, value],
    });
  } else if (type === VictoriaLogsOperationId.StreamId) {
    const notEqual = operator.startsWith("!");
    if (notEqual) {
      visQuery.operations.push({
        id: VictoriaLogsOperationId.NOT,
        params: [],
      });
    }
    let stream_value = ""
    if (values.length > 0) {
      stream_value = "in(" + values.join(",") + ")"
    } else {
      stream_value = value
    }
    visQuery.operations.push({
      id: VictoriaLogsOperationId.StreamId,
      params: [stream_value],
    });
  } else if (type === VictoriaLogsOperationId.Stream) {
    const notEqual = operator === "!=";
    if (notEqual) {
      visQuery.operations.push({
        id: VictoriaLogsOperationId.NOT,
        params: [],
      });
    }
    visQuery.operations.push({
      id: VictoriaLogsOperationId.Stream,
      params: [value.slice(1, -1)],
    });
  } else if (type === VictoriaLogsOperationId.MultiExact) {
    const isExclude = operator === "!=|"
    if (isExclude) {
      visQuery.operations.push({
        id: VictoriaLogsOperationId.NOT,
        params: [],
      });
    }
    const multi_exact_values = "(" + values.map(v => quoteString(v)).join(",") + ")";
    visQuery.operations.push({
      id: VictoriaLogsOperationId.MultiExact,
      params: [key, multi_exact_values],
    });
  }
  const expr = buildVisualQueryToString(visQuery);
  return expr;
}

function filterOut(op: QueryBuilderOperation, key: string, value: string, operator?: string): boolean {
  const is_not = operator === "!=" || operator === "!~";
  if (op.id === VictoriaLogsOperationId.Exact) {
    if (!operator) {
      return (op.params[0] === key && op.params[1] === value);
    }
    return (op.params[0] === key && op.params[1] === value && op.params[2] === is_not);
  } else if (op.id === VictoriaLogsOperationId.Regexp) {
    return (op.params[0] === key && op.params[1] === value);
  } else if (op.id === VictoriaLogsOperationId.RangeComparison) {
    if (!operator) {
      return (op.params[0] === key && op.params[2] === value);
    }
    return (op.params[0] === key && op.params[1] === operator && op.params[2] === value);
  } else if (op.id === VictoriaLogsOperationId.StreamId) {
    return ((op.params[0] as string).includes(value));
  }
  return false;
}

export const removeLabelFromQuery = (query: string, key: string, value: string, operator?: string, defaultField = "_msg"): string => {
  const visQuery = parseExprToVisualQuery(query, defaultField).query;
  const type = getType(operator, key);

  // Remove matching operations and handle logical operators
  let newOps: QueryBuilderOperation[] = [];
  let i = 0;
  while (i < visQuery.operations.length) {
    const op = visQuery.operations[i];
    const isTarget = (type.includes(op.id as VictoriaLogsOperationId) || type === op.id) && filterOut(op, key, value, operator);
    if (isTarget) {
      // Remove logical op before if present
      if (i > 0) {
        const prev = visQuery.operations[i - 1];
        if ([VictoriaLogsOperationId.AND, VictoriaLogsOperationId.OR, VictoriaLogsOperationId.NOT, "and", "or", "not"].includes(prev.id as any)) {
          newOps.pop();
        }
      } else if (i + 1 < visQuery.operations.length) {
        // If first op, remove logical op after if present
        const next = visQuery.operations[i + 1];
        if ([VictoriaLogsOperationId.AND, VictoriaLogsOperationId.OR, VictoriaLogsOperationId.NOT, "and", "or", "not"].includes(next.id as any)) {
          i++;
        }
      }
      // skip this op (removal)
      i++;
      continue;
    }
    newOps.push(op);
    i++;
  }
  visQuery.operations = newOps;

  visQuery.operations.forEach(op => {
    if (op.id === VictoriaLogsOperationId.Logical) {
      op.params[1] = removeLabelFromQuery(op.params[1] as string, key, value, operator, op.params[0] as string);
    }
  });
  return buildVisualQueryToString(visQuery);
};
