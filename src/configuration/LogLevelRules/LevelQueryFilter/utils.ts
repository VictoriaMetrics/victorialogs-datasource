interface BuildQueryExprWithLevelFiltersProps {
  queryExpr: string;
  levelQueryExpr: string;
  isUnknownFilter: boolean;
  isShiftPressed: boolean;
  isQueryContainUnknowFilter?: boolean;
}

/**
 * Constructs a query expression by applying level-based filters to an existing query expression.
 * How it works:
 * 1. if no query, then use the level query
 * 2. if the query exists, then looking for pipe function ----> `filterName1: filterValue1 | filterName2: filterValue2`
 * 3. if no pipe, go to step (5) ----> `filterName1: filterValue2`
 * 4. if a pipe exists, find the first part of the query ----> `filterName1: filterValue1`
 * 5. looking for other level filters in the query ----> `filterName1: filterValue1 level: info`
 * 6. If the level filter exists, add a new level filter at the beginning of the query ----> `level: newinfo filterName1: filterValue1 level: info ...`
 * 7. if the level filter doesn't exist, add a new pipe, and before pipe add level filter ----> `level: newinfo | filterName1 ...`
 *
 * @param {BuildQueryExprWithLevelFiltersProps} props - An object containing properties to build the query expression.
 * @param {string} props.queryExpr - The initial query expression to which level filters may be applied.
 * @param {string} props.levelQueryExpr - The query expression representing the level-based filters.
 * @returns {string} The final query expression after applying the level-based filters. Returns the levelQueryExpr if the queryExpr is empty.
 */
export function buildQueryExprWithLevelFilters(props: BuildQueryExprWithLevelFiltersProps) {
  if (props.queryExpr.trim().length === 0) {
    return props.levelQueryExpr;
  }
  return buildNonEmptyQuery(props);
}

function buildNonEmptyQuery(props: BuildQueryExprWithLevelFiltersProps) {
  const pipePosition = findPipeSeparatorPosition(props.queryExpr);
  if (pipePosition === -1) {
    return buildLevelQuery(props);
  } else {
    const firstPipeQuery = props.queryExpr.slice(0, pipePosition);
    const firstPipeModified = buildLevelQuery({ ...props, queryExpr: firstPipeQuery });
    return firstPipeModified + props.queryExpr.slice(pipePosition);
  }
}

function buildLevelQuery({
  queryExpr,
  levelQueryExpr,
  isUnknownFilter,
  isQueryContainUnknowFilter,
  isShiftPressed
}: BuildQueryExprWithLevelFiltersProps) {
  const isQueryWithFilter = isQueryContainsLevelFilter(queryExpr);
  if (!isQueryWithFilter) {
    return levelQueryExpr + " | " + queryExpr;
  }

  if (queryExpr.trim().length === 0) {
    return levelQueryExpr;
  }

  if (isUnknownFilter) {
    return levelQueryExpr;
  }

  if (isQueryContainUnknowFilter) {
    return levelQueryExpr;
  }

  if (isShiftPressed) {
    return buildMultiLevelFilter(queryExpr, levelQueryExpr);
  }

  return levelQueryExpr;
}

function buildMultiLevelFilter(queryExpr: string, levelQueryExpr: string) {
  if (!queryExpr.includes(levelQueryExpr)) {
    return levelQueryExpr + " OR " + queryExpr;
  } else {
    return queryExpr
      .split(levelQueryExpr)
      .map(trimOR)
      .filter(Boolean)
      .join(" OR ");
  }
}

function trimOR(query: string) {
  let result = query.trim();
  if (result.toLowerCase().startsWith("or")) {
    result = result.slice(2).trim();
  }
  if (result.toLowerCase().endsWith("or")) {
    result = result.slice(0, -2).trim();
  }
  return result;
}

const PIPE_SEPARATOR = "|";

function findPipeSeparatorPosition(queryExpr: string): number {
  const pipeSeparatorPosition = queryExpr.indexOf(PIPE_SEPARATOR);
  if (pipeSeparatorPosition === -1) {
    return -1;
  }

  let quotesCount = 0;
  for (let i = 0; i < queryExpr.length; i++) {
    if (queryExpr[i] === '"' && queryExpr[i - 1] !== "\\") {
      quotesCount++;
      continue;
    }
    if (queryExpr[i] === PIPE_SEPARATOR && quotesCount % 2 === 0) {
      return i;
    }
  }

  return -1;
}

// check if queryExpr contains level filter: `level:...`
function isQueryContainsLevelFilter(queryExpr: string): boolean {
  const levelFilterRegex = /\s*level\s*:\s*([a-zA-Z0-9_]+)\s*/;
  const match = queryExpr.match(levelFilterRegex);
  return Boolean(match);
}


