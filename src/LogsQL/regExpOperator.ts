/**
 * Regular expression for matching variables in a query expression -> filterName:~"$VariableName"
 * */
const variableRegExpPattern = /(^|\||\s)([^\s:~]+)\s*:\s*~\s*(?:"(\$[A-Za-z0-9_.-]+)"|(\$[A-Za-z0-9_.-]+))(?=\s|\||$)/;

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

/**
 * Determines if the last filter in a query expression contains a regular expression operator.
 * The method checks for specific operator patterns, such as `:~` or `=~`, within the context
 * of the last logical filter in the provided query.
 *
 * @param {string} queryExpr - The query expression to be analyzed.
 * @return {boolean} Returns true if a regular expression operator exists in the last filter of the query expression; otherwise, false.
 */
export function isRegExpOperatorInLastFilter(queryExpr: string): boolean {
  let doubleQuotes = false; // to track if we are inside a double quote
  const possiblePrecedingChars = [':', '='];
  let isOperatorAlreadyPresent = false;

  for (let i = queryExpr.length - 1; i >= 0; i--) {
    const char = queryExpr[i];

    if (char === '"') {
      doubleQuotes = true;
      continue;
    }

    // Skip spaces
    if (char === ' ') {
      if (isOperatorAlreadyPresent) {
        return false;
      }
      continue;
    }

    // Stop if we encounter a pipe character
    if (char === '|') {
      return false;
    }

    // Check for double dot operator pattern (:~ or =~)
    if (possiblePrecedingChars.includes(char)) {
      // Look ahead to check if there's a '~' after this operator (skipping spaces)
      let j = i + 1;
      while (j < queryExpr.length && queryExpr[j] === ' ') {
        j++;
      }

      if (j < queryExpr.length && queryExpr[j] === '~' && doubleQuotes) {
        return true;
      }

      isOperatorAlreadyPresent = true;
    }
  }

  return false;
}
