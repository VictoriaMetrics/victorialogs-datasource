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
 * Checks if a character at a given position is a non-escaped quote.
 */
function isNonEscapedQuote(queryExpr: string, index: number): boolean {
  return queryExpr[index] === '"' && queryExpr[index - 1] !== '\\';
}

/**
 * Skips whitespace characters and returns the next non-whitespace index.
 */
function skipWhitespace(queryExpr: string, startIndex: number): number {
  let index = startIndex;
  while (index < queryExpr.length && queryExpr[index] === ' ') {
    index++;
  }
  return index;
}

/**
 * Checks if a regexp operator (~) follows the current position.
 */
function hasRegExpOperator(queryExpr: string, operatorIndex: number, isInQuotedSection: boolean): boolean {
  if (isInQuotedSection) {
    return false;
  }

  const nextIndex = skipWhitespace(queryExpr, operatorIndex + 1);
  return nextIndex < queryExpr.length && queryExpr[nextIndex] === '~';
}

/**
 * Determines if the last filter in a query expression contains a regular expression operator.
 * The method checks for specific operator patterns, such as `:~` or `=~`, within the context
 * of the last logical filter in the provided query.
 *
 * @param {string} queryExpr - The query expression to be analyzed. It is the last part of the query before the multivariable expression
 *                              e.g. 'anotherFilter:value filterName:~"(a|b)_StartMultiVariable_filterValue_EndMultiVariable"| anotherFilter2:value | filterName2:value2'
 *                                    ^------------------------------------^
 * @return {boolean} Returns true if a regular expression operator exists in the last filter of the query expression; otherwise, false.
 */
export function isRegExpOperatorInLastFilter(queryExpr: string): boolean {
  let isInQuotedSection = true; // we always start inside the double quotes, so set it to true
  const operatorChars = [':', '='];
  let hasFoundOperator = false;

  for (let i = queryExpr.length - 1; i >= 0; i--) {
    const char = queryExpr[i];

    if (isNonEscapedQuote(queryExpr, i)) {
      // If we encounter a double quote and it's not inside a variable, return false
      if (!isInQuotedSection) {
        return false;
      }
      isInQuotedSection = false;
      continue;
    }

    // Skip spaces
    if (char === ' ') {
      if (hasFoundOperator) {
        return false;
      }
      continue;
    }

    // Stop if we encounter a pipe character
    if (char === '|' && !isInQuotedSection) {
      return false;
    }

    // Check for regexp operator pattern (:~ or =~)
    if (operatorChars.includes(char)) {
      if (hasRegExpOperator(queryExpr, i, isInQuotedSection)) {
        return true;
      }
      hasFoundOperator = true;
    }
  }

  return false;
}

const escapeRegExpChars = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Processes a query expression by replacing occurrences of variables with double-quoted variables
 * following a specific pattern. Escapes special characters in variable names to safely construct
 * the regular expression used for substitution.
 *
 * @param {string} queryExpr - The input query expression containing placeholders for variables.
 * @param {string[]} variables - An array of variable names to be replaced in the query expression.
 * @return {string} The query expression with variables replaced by double-quoted equivalents.
 */
export function doubleQuoteRegExp(queryExpr: string, variables: string[]): string {
  let newQueryExpr = queryExpr;
  for (const variable of variables) {
    const escapedVariable = escapeRegExpChars(variable);
    newQueryExpr = newQueryExpr.replace(
      new RegExp(`:~\\s*\\$${escapedVariable}\\b`, 'g'),
      `:~"\$${variable}"`
    );
  }
  return newQueryExpr;
}

/**
 * Adjusts the given query expression string by replacing specific regular expression patterns.
 *
 * This method searches for occurrences of the pattern `:~"*"` in the input string,
 * where `*` is surrounded by optional whitespace, and replaces them with the pattern `:~".*"`.
 *
 * @param {string} queryExpr - The query expression string to be processed.
 * @return {string} The modified query expression string with the corrected patterns.
 */
export function correctRegExpValueAll(queryExpr: string): string {
  return queryExpr
    .replace(/:\s*~\s*"\*"/g, ':~".*"') // for regexp operator
    .replace(/:\s*!\s*~\s*"\*"/g, ':!~".*"') // for negative regexp operator
}
