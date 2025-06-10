import { FilterVisualQuery, VisualQuery } from "../../../../types";

export const DEFAULT_FILTER_OPERATOR = "AND";
export const DEFAULT_FIELD = "_msg";

export const filterVisualQueryToString = (
  query: FilterVisualQuery,
  finishedOnly = false
): string => {
  // Convert every value (recursively for nested queries)
  const valueStrings = query.values.map(v =>
    typeof v === 'string' ? v.trim() : `(${filterVisualQueryToString(v, finishedOnly)})`
  );

  const operatorStrings = query.operators.map(op => op.trim());

  let output = '';
  for (let i = 0; i < valueStrings.length; i++) {
    const val = valueStrings[i];
    const isValidValue = /^.+:.+$/.test(val); // something on both sides of ':'

    if (finishedOnly && !isValidValue) {break;}
    if (!val) {continue;} // ignore empty strings from nested calls

    if (i > 0) {
      const op = operatorStrings[i - 1] || DEFAULT_FILTER_OPERATOR;
      output += ` ${op} `;
    }
    output += val;
  }

  return output;
};

export const parseVisualQueryToString = (query: VisualQuery): string => {
  const pipesPart = query.pipes?.length ? ` | ${query.pipes.join(' | ')}` : ''
  return filterVisualQueryToString(query.filters) + pipesPart;
}
