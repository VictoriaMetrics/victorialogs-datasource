import { Query, QueryEditorMode, QueryType } from "../../types";

const queryEditorModeDefaultLocalStorageKey = 'VictoriaLogsQueryEditorModeDefault';

export function getQueryWithDefaults(query: Query): Query {
  let result = query;

  if (!query.editorMode) {
    result.editorMode = getDefaultEditorMode(query.expr);
  }

  if (!query.expr) {
    result.expr = ''
  }

  if (!query.queryType) {
    result.queryType = QueryType.Instant;
  }

  return result;
}

export function changeEditorMode(query: Query, editorMode: QueryEditorMode, onChange: (query: Query) => void) {
  if (query.expr === '') {
    window.localStorage.setItem(queryEditorModeDefaultLocalStorageKey, editorMode);
  }

  onChange({ ...query, editorMode });
}

export function getDefaultEditorMode(expr: string) {
  if (expr != null && expr !== '') {
    return QueryEditorMode.Code;
  }

  const value = window.localStorage.getItem(queryEditorModeDefaultLocalStorageKey);
  return value === QueryEditorMode.Builder ? QueryEditorMode.Builder : QueryEditorMode.Code;
}
