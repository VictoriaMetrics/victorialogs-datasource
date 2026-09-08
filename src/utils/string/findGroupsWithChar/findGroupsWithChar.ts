/**
 * Scans `s` once and returns the indices of the `open` chars whose own group level holds `needle`.
 *
 * Only the innermost group enclosing an occurrence is marked, so a `needle` sitting in a nested
 * group does not mark its ancestors. Quote characters (`"`, `'`, `` ` ``) open a quoted span in
 * which `needle` and the `open`/`close` pair are ignored; a backslash inside a quote escapes the
 * next character. Unmatched `close` chars are tolerated.
 *
 * @param s - the string to scan
 * @param open - the opening bracket character (e.g. `{` or `(`)
 * @param close - the matching closing bracket character (e.g. `}` or `)`)
 * @param needle - the character to look for
 * @returns the set of `open` indices whose group level holds `needle`
 *
 * @example
 *   findGroupsWithChar('(a | b)', '(', ')', '|')       // Set { 0 }
 *   findGroupsWithChar('(a (b | c))', '(', ')', '|')   // Set { 3 } — the outer group is not marked
 *   findGroupsWithChar('("a|b")', '(', ')', '|')       // Set {} — the pipe is quoted
 */
export function findGroupsWithChar(s: string, open: string, close: string, needle: string): Set<number> {
  const marked = new Set<number>();
  const openIndexes: number[] = [];
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') {
        i++;
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
    } else if (c === open) {
      openIndexes.push(i);
    } else if (c === close) {
      openIndexes.pop();
    } else if (c === needle && openIndexes.length > 0) {
      marked.add(openIndexes[openIndexes.length - 1]);
    }
  }
  return marked;
}
