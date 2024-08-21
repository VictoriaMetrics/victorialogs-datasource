import { FilterVisualQuery, VisualQuery } from "../../../../types";

import { BUILDER_OPERATORS, isEmptyQuery } from "./parsing";

interface Context {
  query: VisualQuery;
  errors: string[];
}

type ParsedExpression = string | ParsedExpression[];

export const buildVisualQueryFromString = (expr: string): Context => {
  // This will be modified in the handleExpression
  const visQuery: VisualQuery = {
    filters: { operators: [], values: [] },
    pipes: []
  };

  const context: Context = {
    query: visQuery,
    errors: [],
  };

  try {
    const { filters, pipes } = handleExpression(expr);
    visQuery.filters = filters
    visQuery.pipes = pipes
  } catch (err) {
    console.error(err);
    if (err instanceof Error) {
      context.errors.push(err.message);
    }
  }

  // If we have empty query, we want to reset errors
  if (isEmptyQuery(context.query)) {
    context.errors = [];
  }

  return context;
}

const handleExpression = (expr: string) => {
  const [filterStrPart, ...pipeParts] = expr.split('|').map(part => part.trim());
  const filters = parseStringToFilterVisualQuery(filterStrPart)
  return { filters, pipes: pipeParts };
}

const parseStringToFilterVisualQuery = (expression: string): FilterVisualQuery => {
  const parsedExpressions = parseExpression(expression)

  const groupFilterQuery = (parts: ParsedExpression[]): FilterVisualQuery => {
    const filter: FilterVisualQuery = {
      values: [],
      operators: [],
    }

    const parsePart = (part: ParsedExpression, _index: number) => {
      if (!part) {
        return
      }
      if (typeof part === 'string') {
        if (BUILDER_OPERATORS.includes(part.toUpperCase())) {
          filter.operators.push(part);
        } else {
          filter.values.push(...parseStringPart(part));
        }
      } else {
        filter.values.push(groupFilterQuery(part));
      }
    }
    parts.forEach(parsePart);

    return filter;
  }

  return groupFilterQuery(parsedExpressions)
}

const splitByTopLevelParentheses = (input: string) => {
  const result = [];
  let level = 0;
  let current = '';

  for (let char of input) {
    if (char === '(') {
      if (level === 0 && current.trim() !== '') {
        result.push(current.trim());
        current = '';
      }
      level++;
      current += char;
    } else if (char === ')') {
      level--;
      current += char;
      if (level === 0) {
        result.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.trim() !== '') {
    result.push(current.trim());
  }
  const regex = new RegExp(`(?:^|\\s)(${BUILDER_OPERATORS.join('|')})\\s*(?:$|\\s+)`, 'i')
  return result.map(part => part.includes('(') ? part : part.split(regex)).flat(1)
}

const parseExpression = (input: string): ParsedExpression[] => {
  const parts = splitByTopLevelParentheses(input);

  return parts.map(part => {
    if (part.startsWith('(') && part.endsWith(')')) {
      // Recursively parse the inner expression
      return parseExpression(part.slice(1, -1));
    } else {
      return part.trim();
    }
  });
}

const parseStringPart = (expression: string) => {
  const regex = /("[^"]*"|'[^']*'|\S+)\s*:\s*("[^"]*"|'[^']*'|\S+)?|\S+/g;
  const matches = expression.match(regex) || [];
  return matches.map(match => match.trim());
}
