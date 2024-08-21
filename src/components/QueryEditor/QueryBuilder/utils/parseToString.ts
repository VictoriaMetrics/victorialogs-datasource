import { FilterVisualQuery, VisualQuery } from "../../../../types";

export const DEFAULT_FILTER_OPERATOR = "AND";
export const DEFAULT_FIELD = "_msg";

const filterVisualQueryToString = (query: FilterVisualQuery): string => {
  const valueStrings: string[] = [];

  for (let i = 0; i < query.values.length; i++) {
    const value = query.values[i];
    if (typeof value === 'string') {
      valueStrings.push(value);
    } else {
      valueStrings.push(`(${filterVisualQueryToString(value)})`);
    }
  }

  const operatorStrings = query.operators.map(op => op.trim());

  return valueStrings.reduce((acc, val, index) => {
    const operator = operatorStrings[index - 1] || DEFAULT_FILTER_OPERATOR;
    return acc + (index === 0 ? '' : ` ${operator} `) + val;
  }, '');
}

export const parseVisualQueryToString = (query: VisualQuery): string => {
  // TODO add parse pipes
  return filterVisualQueryToString(query.filters);
}
