/**
 * Corrects the syntax of exact operators in a given expression string by replacing
 * occurrences of ": in(.*)" with ":in(*)" or for the _stream field "word in (.*)" with "word in (*)".
 *
 * @param {string} expr - The input expression string to be corrected.
 * @return {string} The corrected expression string with updated syntax.
 */
export function correctMultiExactOperatorValueAll(expr: string): string {
  return expr
    // replace ": in(*)" with ":in(*)"
    .replace(/:\s*in\(\.\*\)/g, ":in(*)")
    // replace "word in (.*)" with "word in (*)" for the stream field
    .replace(/("(?:\\.|[^"\\])*"|[^\s:]+)\s+in\(\.\*\)/g, "$1 in(*)");
}
