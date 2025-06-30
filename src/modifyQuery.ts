import { VictoriaLogsOperationId } from "./components/QueryEditor/QueryBuilder/Operations";
import { buildVisualQueryToString, parseExprToVisualQuery } from "./components/QueryEditor/QueryBuilder/QueryModeller";
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

const getType = (operator: string, key: string): "exact" | "regex" | "range" | "stream" => {
  if (operator.endsWith("=")) {
    return "exact";
  } else if (operator.endsWith("~")) {
    return "regex";
  } else if (operator === "<" || operator === ">") {
    return "range";
  } else if (operator === "" && key === LABEL_STREAM_ID) {
    return "stream";
  } else {
    throw new Error(`Unsupported operator: ${operator}`);
  }
}

export const addLabelToQuery = (query: string, key: string, value: string, operator: string): string => {
  const type = getType(operator, key);
  const visQuery = parseExprToVisualQuery(query).query;
  if (type === "exact") {
    const notEqual = operator === "!=";
    visQuery.operations.push({
      id: VictoriaLogsOperationId.Exact,
      params: [key, value, notEqual, false, false],
    });
  } else if (type === "regex") {
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
  } else if (type === "range") {
    visQuery.operations.push({
      id: VictoriaLogsOperationId.RangeComparison,
      params: [key, operator, value],
    });
  } else if (type === "stream") {
    visQuery.operations.push({
      id: VictoriaLogsOperationId.StreamId,
      params: [`${value}`],
    });
  }
  return buildVisualQueryToString(visQuery);
}

export const removeLabelFromQuery = (query: string, key: string, value: string, operator?: string): string => {
  const visQuery = parseExprToVisualQuery(query).query;
  if (operator !== undefined) {
    const type = getType(operator, key);
    if (type === "exact") {
      visQuery.operations = visQuery.operations.filter(op => {
        if (op.id === VictoriaLogsOperationId.Exact) {
          return !(op.params[0] === key && op.params[1] === value && (operator === "!=" ? !op.params[2] : op.params[2]));
        }
        return true;
      })
    } else if (type === "regex") {
      visQuery.operations = visQuery.operations.filter(op => {
        if (op.id === VictoriaLogsOperationId.Regexp) {
          return !(op.params[0] === key && op.params[1] === value);
        }
        return true;
      })
    } else if (type === "range") {
      visQuery.operations = visQuery.operations.filter(op => {
        if (op.id === VictoriaLogsOperationId.RangeComparison) {
          return !(op.params[0] === key && op.params[1] === operator && op.params[2] === value);
        }
        return true;
      })
    } else if (type === "stream") {
      visQuery.operations = visQuery.operations.filter(op => {
        if (op.id === VictoriaLogsOperationId.StreamId) {
          return !((op.params[0] as string).includes(value));
        }
        return true;
      })
    }
        
  }
  return buildVisualQueryToString(visQuery);
};
