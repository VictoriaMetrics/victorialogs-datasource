/**
 * Removes LogsQL `# ...` line comments while preserving `#` inside quoted/backticked spans.
 * Runs before newline normalization so a comment can be terminated by its end-of-line.
 */
export function stripComments(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      const raw = c === '`'; // backtick strings do not process backslash escapes
      out += c;
      i++;
      while (i < s.length) {
        if (!raw && s[i] === '\\' && i + 1 < s.length) {
          out += s[i] + s[i + 1];
          i += 2;
          continue;
        }
        out += s[i];
        if (s[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '#') {
      while (i < s.length && s[i] !== '\n') {
        i++; // drop the comment up to (but not including) the end of line
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
