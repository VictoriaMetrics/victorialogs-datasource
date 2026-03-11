/**
 * Splits a LogsQL query string by top-level pipe `|` operators.
 *
 * Pipes inside quoted strings (`"`, `'`, `` ` ``), parentheses `()`,
 * or curly braces `{}` are NOT treated as delimiters.
 * Brackets inside quoted strings are treated as part of the string.
 * Escape sequences (e.g. `\"`) inside quotes are handled correctly.
 *
 * Each segment is trimmed. Empty segments are preserved to maintain
 * positional correspondence with the original query.
 *
 * @example
 *   splitByPipes('* | stats count()') // ['*', 'stats count()']
 *   splitByPipes('{app="a|b"} | keep _msg') // ['{app="a|b"}', 'keep _msg']
 */
export function splitByPipes(expr: string): string[] {
  if (!expr) {
    return [''];
  }

  const segments: string[] = [];
  let depth = 0;
  let quoteChar: string | null = null;
  let segmentStart = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    // Handle escape sequences inside quotes
    if (quoteChar && ch === '\\') {
      i++;
      continue;
    }

    // Toggle quote state
    if (ch === '"' || ch === "'" || ch === '`') {
      if (quoteChar === ch) {
        quoteChar = null;
      } else if (!quoteChar) {
        quoteChar = ch;
      }
      continue;
    }

    // Skip content inside quotes
    if (quoteChar) {
      continue;
    }

    // Track bracket depth
    if (ch === '(' || ch === '{') {
      depth++;
      continue;
    }
    if (ch === ')' || ch === '}') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    // Top-level pipe found
    if (ch === '|' && depth === 0) {
      segments.push(expr.slice(segmentStart, i).trim());
      segmentStart = i + 1;
    }
  }

  segments.push(expr.slice(segmentStart).trim());

  return segments;
}
