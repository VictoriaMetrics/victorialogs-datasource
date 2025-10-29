/**
 * Regular expression for matching variables in a query expression -> filterName:~"$VariableName"
 * */
const variableRegExp = /(^|\||\s)([^\s:~]+)\s*:\s*~\s*(?:"\$([A-Za-z0-9_.-]+)"|\$([A-Za-z0-9_.-]+)|"([^"]+)"|([^\s|]+))(?=\s|\||$)/;

export function getQueryExprVariableRegExp(queryExpr: string) {
  return variableRegExp.exec(queryExpr);
}
