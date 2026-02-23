export const statsPipeFunctions = [
  'avg',
  'count',
  'count_empty',
  'count_uniq',
  'count_uniq_hash',
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
  'sum',
  'sum_len',
  'uniq_values',
  'values'
] as const;

type StatsPipeFunctions = typeof statsPipeFunctions[number];

export const isExprHasStatsPipeFunctions = (expr: string) => {
  const regex = new RegExp(`.*\\|.*\\b(${statsPipeFunctions.join('|')})\\b`, 'mi');
  return regex.test(expr);
};

export const isExprHasStatsPipeFunc = (expr: string, statFunc: StatsPipeFunctions) => {
  const regex = new RegExp(`.*\\|.*\\b(${statFunc})\\b`, 'mi');
  return regex.test(expr);
};
