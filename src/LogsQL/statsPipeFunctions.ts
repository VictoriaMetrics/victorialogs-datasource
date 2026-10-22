export const statsPipeFunctions = [
  'any',
  'avg',
  'count',
  'count_empty',
  'count_uniq',
  'count_uniq_hash',
  'field_max',
  'field_min',
  'histogram',
  'json_values',
  'max',
  'median',
  'min',
  'quantile',
  'rate',
  'rate_sum',
  'row_any',
  'row_max',
  'row_min',
  'stddev',
  'sum',
  'sum_len',
  'uniq_values',
  'values'
] as const;

type StatsPipeFunctions = typeof statsPipeFunctions[number];

const hasStatsFunctionCall = (expr: string, names: readonly string[]): boolean => {
  const regex = new RegExp(`\\|.*\\b(?:${names.join('|')})\\s*\\(`, 'mi');
  return regex.test(expr);
};

export const isExprHasStatsPipeFunctions = (expr: string) => hasStatsFunctionCall(expr, statsPipeFunctions);

export const isExprHasStatsPipeFunc = (expr: string, statFunc: StatsPipeFunctions) => hasStatsFunctionCall(expr, [statFunc]);
