import { escapeLogsQLQuotedValue } from '../utils/query/logsqlEscape';

import { getOpenQuote } from './openQuote';
import { isRegExpOperatorInLastFilter } from './regExpOperator';

const VALUES_SEPARATOR = '_separator_';
// a value may be empty or contain line breaks, so the values are matched with `[\s\S]*?`
const multiVariablePattern = /\$_StartMultiVariable_([\s\S]*?)_EndMultiVariable/g;

/**
 * Wraps variable values into a placeholder. The values are formatted later by
 * `replaceMultiVariables`, when the place of the variable in the query is known
 */
export function wrapMultiVariable(values: string[]): string {
  return `$_StartMultiVariable_${values.join(VALUES_SEPARATOR)}_EndMultiVariable`;
}

/**
 * Replaces the placeholders made by `wrapMultiVariable` with the variable values,
 * formatted for the place they are used in:
 * - a regexp filter (`field:~"$var"`) gets `(v1|v2)`
 * - `in($var)` gets a list of quoted values
 * - any other place gets `v1 OR v2`
 *
 * A value put inside a double-quoted string is escaped, so it cannot end the string.
 */
export function replaceMultiVariables(input: string): string {
  // Variable values are raw and may contain quotes, so the place of a placeholder
  // is read from the query without the placeholders that come before it
  let queryBefore = '';
  let lastIndex = 0;

  return input.replace(multiVariablePattern, (match, valueList: string, offset: number) => {
    queryBefore += input.slice(lastIndex, offset);
    lastIndex = offset + match.length;

    const values = valueList.split(VALUES_SEPARATOR);
    const precedingChars = queryBefore.replace(/\s+/g, '').slice(-3);

    if (isRegExpOperatorInLastFilter(queryBefore)) {
      return `(${values.map(escapeLogsQLQuotedValue).join('|')})`;
    } else if (precedingChars.includes('in(')) {
      return values.map(value => JSON.stringify(value)).join(',');
    }

    const isInDoubleQuotes = getOpenQuote(queryBefore) === '"';
    return (isInDoubleQuotes ? values.map(escapeLogsQLQuotedValue) : values).join(' OR ');
  });
}
