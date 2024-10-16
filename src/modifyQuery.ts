import { buildVisualQueryFromString, splitExpression } from "./components/QueryEditor/QueryBuilder/utils/parseFromString";
import { parseVisualQueryToString } from "./components/QueryEditor/QueryBuilder/utils/parseToString";
import { FilterVisualQuery } from "./types";

const getKeyValue = (key: string, value: string): string => {
  return `${key}:"${value}"`
}

export function queryHasFilter(query: string, key: string, value: string): boolean {
  return query.includes(getKeyValue(key, value))
}

export const addLabelToQuery = (query: string, key: string, value: string, operator: string): string => {
  const [filters, ...pipes] = splitExpression(query)
  const insertPart = `${operator} ${getKeyValue(key, value)}`
  const pipesPart = pipes?.length ? `| ${pipes.join(' | ')}` : ''
  return (`${filters} ${insertPart} ${pipesPart}`).trim()
}

export const removeLabelFromQuery = (query: string, key: string, value: string): string => {
  const { query: { filters, pipes }, errors } = buildVisualQueryFromString(query);
  if (errors.length) {
    console.error(errors.join('\n'));
    return query;
  }

  const keyValue = getKeyValue(key, value);
  recursiveRemove(filters, keyValue)
  return parseVisualQueryToString({ filters, pipes })
}

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
