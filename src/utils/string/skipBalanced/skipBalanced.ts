/**
 * Scans from `openIdx` (which should sit on an `open` char) and returns the index just past the
 * matching `close` char, accounting for nested `open`/`close` pairs.
 *
 * Quote characters (`"`, `'`, `` ` ``) open a quoted span in which `open`/`close` are ignored, so
 * brackets inside strings never unbalance the block; a backslash inside a quote escapes the next
 * character. If the block is never closed, `s.length` is returned.
 *
 * @param s - the string to scan
 * @param openIdx - index to start scanning from, normally the position of an `open` char
 * @param open - the opening bracket character (e.g. `{` or `(`)
 * @param close - the matching closing bracket character (e.g. `}` or `)`)
 * @returns the index immediately after the matching `close`, or `s.length` if unterminated
 *
 * @example
 *   skipBalanced('{a{b}c}', 0, '{', '}') // 7
 *   skipBalanced('(a)b', 0, '(', ')')    // 3
 *   '{a}b'.slice(skipBalanced('{a}b', 0, '{', '}')) // 'b'
 */
export function skipBalanced(s: string, openIdx: number, open: string, close: string): number {
  let depth = 0;
  let quote: string | null = null;
  let i = openIdx;
  for (; i < s.length; i++) {
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
      depth++;
    } else if (c === close) {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
  }
  return i;
}
