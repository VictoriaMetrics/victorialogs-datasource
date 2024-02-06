import { Query, QueryType } from "../../types";

export function getQueryWithDefaults(query: Query): Query {
  let result = query;

  if (query.expr == null) {
    result = { ...result, expr: '' };
  }

  if (query.queryType == null) {
    result = { ...result, queryType: QueryType.Range };
  }

  return result;
}
