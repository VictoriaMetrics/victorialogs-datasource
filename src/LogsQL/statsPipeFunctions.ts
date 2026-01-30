export const statsPipeFunctions = [
  "avg",
  "count",
  "count_empty",
  "count_uniq",
  "count_uniq_hash",
  "histogram",
  "json_values",
  "max",
  "median",
  "min",
  "quantile",
  "rate",
  "rate_sum",
  "row_any",
  "row_max",
  "row_min",
  "sum",
  "sum_len",
  "uniq_values",
  "values"
];

export const isExprHasStatsPipeFunctions = (expr: string) => {
  const regex = new RegExp(`.*\\|.*\\b(${statsPipeFunctions.join("|")})\\b`, "mi");
  return regex.test(expr)
}
