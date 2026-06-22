import { extractMsgSearchWords } from './LogsQL/extractMsgSearchWords';

/**
 * Returns regex-ready search terms (targeting the `_msg` field) for Grafana
 * `frame.meta.searchWords` highlighting, parsed from a LogsQL query
 */
export function getHighlighterExpressionsFromQuery(input = ''): string[] {
  return extractMsgSearchWords(input);
}
