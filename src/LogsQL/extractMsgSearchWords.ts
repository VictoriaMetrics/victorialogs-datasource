import { escapeRegExp } from 'lodash';

import { skipBalanced } from '../utils';

import { splitByPipes } from './splitByPipes';
import { stripComments } from './stripComments';

// Tabs/newlines are normalized to spaces in extractMsgSearchWords, so a plain space is enough here
const TERM_SEPARATORS = [' ', ':', '|', '(', ')', '{', '}'];

/**
 * Reads a quoted string starting at `openIdx` (quote char at that index)
 * Returns the unescaped inner content and the index just past the closing quote.
 */
function readQuoted(s: string, openIdx: number): { value: string; next: number } {
  const quote = s[openIdx];
  let value = '';
  let i = openIdx + 1;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      value += s[i + 1];
      i++;
      continue;
    }
    if (c === quote) {
      return { value, next: i + 1 };
    }
    value += c;
  }
  return { value, next: i };
}

/**
 * Reads a quoted string starting at `openIdx` without unescaping its content
 * Returns the raw inner text (backslashes preserved) and the index past the closing quote.
 */
function readRawQuoted(s: string, openIdx: number): { value: string; next: number } {
  const quote = s[openIdx];
  let i = openIdx + 1;
  for (; i < s.length; i++) {
    if (s[i] === '\\') {
      i++; // keep the escaped char in the span
      continue;
    }
    if (s[i] === quote) {
      return { value: s.slice(openIdx + 1, i), next: i + 1 };
    }
  }
  return { value: s.slice(openIdx + 1), next: i };
}

/**
 * Reads a single filter value at `i` (after a `field:` prefix or as a bare value)
 * A leading `-` or `!` marks the value as negated, so it is consumed but yields no term.
 */
function readValueTerm(s: string, i: number): { term: string | null; isRegex: boolean; next: number } {
  let negated = false;
  if (s[i] === '-' || s[i] === '!') {
    negated = true;
    i++;
  }
  const result = readValueTermInner(s, i);
  return negated ? { ...result, term: null } : result;
}

/**
 * Reads a single non-negated filter value at `i`
 * Returns the regex-ready term (or null), whether it is a raw regexp, and the index past the value.
 */
function readValueTermInner(s: string, i: number): { term: string | null; isRegex: boolean; next: number } {
  // regexp value:  ~"re"
  if (s[i] === '~') {
    let j = i + 1;
    while (j < s.length && s[j] === ' ') {
      j++;
    }
    if (s[j] === '"' || s[j] === "'" || s[j] === '`') {
      const backticked = s[j] === '`';
      const { value, next } = readRawQuoted(s, j);
      const term = backticked ? value : value.replace(/\\\\/g, '\\');
      return { term: term || null, isRegex: true, next };
    }
    return { term: null, isRegex: false, next: j };
  }

  // exact value:  ="exact" or =word
  let j = i;
  if (s[j] === '=') {
    j++;
  }

  // quoted value
  if (s[j] === '"' || s[j] === "'" || s[j] === '`') {
    const { value, next } = readQuoted(s, j);
    return { term: value ? escapeRegExp(value) : null, isRegex: false, next };
  }

  // bare word value, stripping a trailing prefix star
  const start = j;
  while (j < s.length && !TERM_SEPARATORS.includes(s[j])) {
    j++;
  }
  let word = s.slice(start, j);
  if (word.endsWith('*')) {
    word = word.slice(0, -1);
  }
  return { term: word ? escapeRegExp(word) : null, isRegex: false, next: j };
}

/**
 * Scans a single filter sub-query and returns regex-ready `_msg` search terms.
 * The same grammar applies to the first query segment and to filter pipes.
 */
function scanFilterSegment(segment: string): string[] {
  const results: string[] = [];
  let i = 0;
  let negateNext = false;

  const emit = (term: string | null) => {
    if (term && !negateNext) {
      results.push(term);
    }
    negateNext = false;
  };

  while (i < segment.length) {
    const ch = segment[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    // skip the {...} stream selector entirely
    if (ch === '{') {
      i = skipBalanced(segment, i, '{', '}');
      negateNext = false;
      continue;
    }

    // grouping parens
    if (ch === '(') {
      if (negateNext) {
        i = skipBalanced(segment, i, '(', ')');
        negateNext = false;
      } else {
        i++;
      }
      continue;
    }
    if (ch === ')') {
      i++;
      continue;
    }

    // negation prefixes
    if (ch === '-' || ch === '!') {
      negateNext = true;
      i++;
      continue;
    }

    // match-all star is not a search term
    if (ch === '*') {
      i++;
      negateNext = false;
      continue;
    }

    // quoted phrase on the default _msg field
    if (ch === '"' || ch === "'" || ch === '`') {
      const { value, next } = readQuoted(segment, i);
      i = next;
      emit(value ? escapeRegExp(value) : null);
      continue;
    }

    // bare regexp/exact filter on _msg:  ~"re"  or  ="exact"
    if (ch === '~' || ch === '=') {
      const { term, next } = readValueTerm(segment, i);
      i = next;
      emit(term);
      continue;
    }

    // identifier — operator keyword, field reference, or bare _msg word
    const start = i;
    while (i < segment.length && !TERM_SEPARATORS.includes(segment[i])) {
      i++;
    }
    let word = segment.slice(start, i);

    const upper = word.toUpperCase();
    if (upper === 'AND' || upper === 'OR') {
      continue;
    }
    if (upper === 'NOT') {
      negateNext = true;
      continue;
    }

    if (segment[i] === ':') {
      i++; // consume ':'
      while (segment[i] === ' ') {
        i++; // a space after the colon still binds the value to its field
      }
      // grouped value: `field:(...)` — the whole group binds to the field
      if (segment[i] === '(') {
        if (word === '_msg') {
          continue; // scan the group as default _msg context
        }
        i = skipBalanced(segment, i, '(', ')'); // group filters a non-_msg field — skip it
        negateNext = false;
        continue;
      }
      const { term, next } = readValueTerm(segment, i);
      i = next;
      // function-style value: `field:fn(...)` — the value word is a function name, not a term
      if (segment[i] === '(') {
        if (word === '_msg') {
          continue; // scan the function args as default _msg context
        }
        i = skipBalanced(segment, i, '(', ')'); // function filters a non-_msg field — skip it
        negateNext = false;
        continue;
      }
      emit(word === '_msg' ? term : null);
      continue;
    }

    // function-style filter call: `word(...)` — the word is a function name, not a term
    // (e.g. i(error), exact(error)); the group itself is scanned as default _msg context
    if (segment[i] === '(') {
      continue;
    }

    // bare word filter on _msg
    if (word.endsWith('*')) {
      word = word.slice(0, -1);
    }
    emit(word ? escapeRegExp(word) : null);
  }

  return results;
}

const FILTER_PIPE = /^filter(\s|$)/i;
// A leading `<field>:` token — the unambiguous sign of a filter expression
const FIELD_FILTER = /^[^\s:|(){}]+:/;
const ALLOWED_START_FILTER_PIPE_QUOTES = ['"', "'", '`'];
/**
 * For a pipe segment (anything after the first top-level `|`), returns the filter
 * sub-query to scan, or null when the segment is not a filter and must be skipped.
 * A segment counts as a filter when it starts with the `filter` keyword, a quoted
 * phrase, or a `<field>:` filter (including `_msg:`) — bare words elsewhere are
 * field/function names of pipe operations and must not be highlighted.
 */
function filterBodyOfPipe(segment: string): string | null {
  if (FILTER_PIPE.test(segment)) {
    return segment.slice('filter'.length);
  }
  const ch = segment[0];
  if (ALLOWED_START_FILTER_PIPE_QUOTES.includes(ch)) {
    return segment;
  }
  if (FIELD_FILTER.test(segment)) {
    return segment;
  }
  return null;
}

/**
 * Extracts regex-ready search terms targeting the default `_msg` field from a LogsQL query,
 * for use in Grafana `frame.meta.searchWords` highlighting. The first segment (before the first
 * top-level `|`) is always scanned as a filter; later segments are scanned only when they are
 * filter pipes (start with `filter`, a quoted phrase, or `_msg:`). Literal terms are escaped;
 * regexp filters are returned raw.
 */
export function extractMsgSearchWords(expr = ''): string[] {
  const exprWithoutComments = stripComments(expr);
  const normalizedExpr = exprWithoutComments.replace(/[\t\n\r]/g, ' ');
  const segments = splitByPipes(normalizedExpr);
  const results: string[] = [];

  segments.forEach((segment, index) => {
    if (index === 0) {
      results.push(...scanFilterSegment(segment));
      return;
    }
    const body = filterBodyOfPipe(segment);
    if (body !== null) {
      results.push(...scanFilterSegment(body));
    }
  });

  return results;
}
