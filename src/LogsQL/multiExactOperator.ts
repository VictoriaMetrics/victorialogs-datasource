/**
 * Corrects the syntax of exact operators in a given expression string by replacing
 * occurrences of:
 * 1. ":in(.*)" with ":in(*)"
 * 2. ":in(".*")" with ":in(*)"
 * 3. ":in("*") with ":in(*)"
 * 4. "word in (.*)" with "word in (*)" for the _stream field
 * 5. `word in (".*")` with `word in (*)` for the _stream field
 * 6. `word in ("*")` with `word in (*)` for the _stream field
 *
 * @param {string} expr - The input expression string to be corrected.
 * @return {string} The corrected expression string with updated syntax.
 */
export function correctMultiExactOperatorValueAll(expr: string): string {
  return expr
    // replace ": in(*)" with ":in(*)"
    .replace(/:\s*in\(\s*("?\.?\*"?)\s*\)/g, ':in(*)')
    // replace "word in (.*)" with "word in (*)" for the stream field
    .replace(/("(?:\\.|[^"\\])*"|[^\s:]+)\s+in\(\s*("?\.?\*"?)\s*\)/g, '$1 in(*)');
}
