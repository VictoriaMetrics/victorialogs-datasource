import { SyntaxNode } from '@lezer/common';
import { escapeRegExp } from 'lodash';

import { Filter, FilterOp, LineFilter, OrFilter, parser, PipeExact, PipeMatch, String } from '@grafana/lezer-logql';

export function getNodesFromQuery(query: string, nodeTypes?: number[]): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  const tree = parser.parse(query);
  tree.iterate({
    enter: (node): false | void => {
      if (nodeTypes === undefined || nodeTypes.includes(node.type.id)) {
        nodes.push(node.node);
      }
    },
  });
  return nodes;
}

export function getStringsFromLineFilter(filter: SyntaxNode): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  let node: SyntaxNode | null = filter;
  do {
    const string = node.getChild(String);
    if (string && !node.getChild(FilterOp)) {
      nodes.push(string);
    }
    node = node.getChild(OrFilter);
  } while (node != null);

  return nodes;
}

export function getHighlighterExpressionsFromQuery(input = ''): string[] {
  const results = [];

  const filters = getNodesFromQuery(input, [LineFilter]);

  for (const filter of filters) {
    const pipeExact = filter.getChild(Filter)?.getChild(PipeExact);
    const pipeMatch = filter.getChild(Filter)?.getChild(PipeMatch);
    const strings = getStringsFromLineFilter(filter);

    if ((!pipeExact && !pipeMatch) || !strings.length) {
      continue;
    }

    for (const string of strings) {
      const filterTerm = input.substring(string.from, string.to).trim();
      const backtickedTerm = filterTerm[0] === '`';
      const unwrappedFilterTerm = filterTerm.substring(1, filterTerm.length - 1);

      if (!unwrappedFilterTerm) {
        continue;
      }

      let resultTerm = '';

      // Only filter expressions with |~ operator are treated as regular expressions
      if (pipeMatch) {
        resultTerm = backtickedTerm ? unwrappedFilterTerm : unwrappedFilterTerm.replace(/\\\\/g, '\\');
      } else {
        // We need to escape this string so it is not matched as regular expression
        resultTerm = escapeRegExp(unwrappedFilterTerm);
      }

      if (resultTerm) {
        results.push(resultTerm);
      }
    }
  }
  return results;
}
