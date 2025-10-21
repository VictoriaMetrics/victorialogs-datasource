import { AdHocVariableFilter } from '@grafana/data';

import {
  buildVisualQueryFromString,
  splitExpression
} from "./components/QueryEditor/QueryBuilder/utils/parseFromString";
import { parseVisualQueryToString } from "./components/QueryEditor/QueryBuilder/utils/parseToString";
import { FilterVisualQuery } from "./types";

const operators = ["=", "!=", "=~", "!~", "<", ">"];
const multiValueOperators = ["=|", "!=|"]
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

const getMultiValueInsert = (key: string, values: string[], operator: string): string => {
  const isExclude = operator === "!=|"

  if (key === "_stream") {
    const expr = values.map(v => `${key}: ${v}`).join(" OR ")
    return isExclude ? `!(${expr})` : `(${expr})`;
  }

  const valuesStr = values.map(v => `"${v}"`).join(",");
  const expr = `${key}:in(${valuesStr})`
  return isExclude ? `!(${expr})` : expr;
}

export const addLabelToQuery = (query: string, filter: AdHocVariableFilter): string => {
  const { key, value, values = [], operator } = filter;
  const [filters, ...pipes] = splitExpression(query)

  const isMultiValue = multiValueOperators.includes(operator)
  const insertPart = isMultiValue
    ? getMultiValueInsert(key, values, operator)
    : getFilterInsertValue(key, value, operator)

  const pipesPart = pipes?.length ? `| ${pipes.join(' | ')}` : ''
  return filters.length ? (`${filters} AND ${insertPart} ${pipesPart}`).trim() : (`${insertPart} ${pipesPart}`).trim()
}

export const removeLabelFromQuery = (query: string, key: string, value: string, operator?: string): string => {
  const { query: { filters, pipes }, errors } = buildVisualQueryFromString(query);

  if (errors.length) {
    console.error(errors.join('\n'));
    return query;
  }

  const keyValues = operator
    ? [getFilterInsertValue(key, value, operator)]
    : operators.map(op => getFilterInsertValue(key, value, op));

  keyValues.forEach(keyValue => recursiveRemove(filters, keyValue));

  return parseVisualQueryToString({ filters, pipes });
};

const recursiveRemove = (filters: FilterVisualQuery, keyValue: string): boolean => {
  const { values, operators } = filters;
  let removed = false;

  for (let i = values.length - 1; i >= 0; i--) {
    const val = values[i];
    const isString = typeof val === 'string'
    const isFilterObject = typeof val === 'object' && 'values' in val

    if (isString && val === keyValue) {
      // If the string matches keyValue, delete it and the operator
      values.splice(i, 1);
      (i > 0 && i - 1 < operators.length) && operators.splice(i - 1, 1);
      removed = true;
    } else if (isFilterObject) {
      // If it is an object of type FilterVisualQuery, recursively check it
      const wasRemoved = recursiveRemove(val, keyValue);
      removed = wasRemoved || removed;
    }
  }

  return removed;
}

export const logsSortOrders = {
  asc: "Ascending",
  desc: "Descending"
};

export const addSortPipeToExpr = (expr: string, sortDirection: string) => {
  const exprContainsSort = /\|\s*sort\s*by\s*\(/i.test(expr); // checks for existing sort pipe `sort by (`
  const sortPipe = `sort by (_time) ${sortDirection === logsSortOrders.asc ? 'asc' : 'desc'}`;
  return exprContainsSort ? expr : `${expr} | ${sortPipe}`;
}
