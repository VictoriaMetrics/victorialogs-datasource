import { VictoriaLogsOperationId } from "./components/QueryEditor/QueryBuilder/Operations";
import { buildVisualQueryToString, parseExprToVisualQuery } from "./components/QueryEditor/QueryBuilder/QueryModeller";

const operators = ["=", "!=", "=~", "!~", "<", ">"]

export function queryHasFilter(query: string, key: string, value: string, operator?: string): boolean {
  const applicableOperators = operator ? [operator] : operators;
  return applicableOperators.some(op => query.includes(getFilterInsertValue(key, value, op)));
}

const getFilterInsertValue = (key: string, value: string, operator: string): string => {
  switch (operator) {
    case "=~":
      return `${key}:~"${value}"`
    default:
      return `${key}:${operator}"${value}"`
  }
}

export const addLabelToQuery = (query: string, key: string, value: string, operator: string): string => {
  const visQuery = parseExprToVisualQuery(query).query;
  const notExact = (operator === "!=" || operator.toLowerCase() === "not")
  visQuery.operations.push({
    id: VictoriaLogsOperationId.Exact,
    params: [key, value, notExact, false, false],
  });
  return buildVisualQueryToString(visQuery);
}

export const removeLabelFromQuery = (query: string, key: string, value: string, operator?: string): string => {
  let notEqual = false;
  if (operator === "!=" || operator?.toLowerCase() === "not") {
    notEqual = true;
  }
  const visQuery = parseExprToVisualQuery(query).query;
  let i = 0;
  for (const operation of visQuery.operations) {
    if (operation.id === VictoriaLogsOperationId.Exact && operation.params[0] === key && operation.params[1] === value) {
      if (operation.params[2] === notEqual) { // matches
        continue;
      } else if (operation.params[2] === true && !notEqual) { // operation should be equal but operation in notEqual
        continue;
      } else if (i > 0 && visQuery.operations[i - 1].id === VictoriaLogsOperationId.NOT) {
        continue;
      }
      visQuery.operations = visQuery.operations.filter(op => op !== operation);
      break;
    }
    i++;
  }
  return buildVisualQueryToString(visQuery);
};
