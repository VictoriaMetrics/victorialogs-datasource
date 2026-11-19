const QUOTE_CHARS = ['"', "'", '`'];

/**
 * Returns the quote character of the string literal left open at the end of the
 * given query part, or null when the part ends outside of a string literal.
 * A backslash escapes the next character inside `"` and `'` literals, while a
 * backtick literal is raw.
 *
 * @example
 *   getOpenQuote('field:"prefix ') // '"'
 *   getOpenQuote('field:"value" other:') // null
 */
export function getOpenQuote(expr: string): string | null {
  let quoteChar: string | null = null;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if (quoteChar && quoteChar !== '`' && ch === '\\') {
      i++;
      continue;
    }

    if (quoteChar) {
      if (ch === quoteChar) {
        quoteChar = null;
      }
      continue;
    }

    if (QUOTE_CHARS.includes(ch)) {
      quoteChar = ch;
    }
  }

  return quoteChar;
}
