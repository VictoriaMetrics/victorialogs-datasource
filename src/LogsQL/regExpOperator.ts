/**
 * Regular expression for matching variables in a query expression -> filterName:~"$VariableName"
 * */
const variableRegExpPattern = /(^|\||\s)([^\s:~]+)\s*:\s*~\s*(?:"(\$[A-Za-z0-9_.-]+)"|(\$[A-Za-z0-9_.-]+)|"([^"]+)"|([^\s|]+))(?=\s|\||$)/;

export function getQueryExprVariableRegExp(queryExpr: string) {
  return new RegExp(variableRegExpPattern).exec(queryExpr);
}

export function replaceRegExpOperatorToOperator(queryExpr: string, operator = ':') {
  return queryExpr.replace(new RegExp(variableRegExpPattern, 'g'), (match, p1, p2, p3, p4) => {
    // p3 - "$variable"
    // p4 - $variable
    const variable = p3 || p4;
    if (variable) {
      const value = p3 ? `"${variable}"` : variable;
      return `${p1}${p2}${operator}${value}`;
    }
    return match;
  });
}
