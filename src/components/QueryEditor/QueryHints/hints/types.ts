export interface QueryHints {
  sections: QueryHintSection[];
}

export interface QueryHintSectionBase<T> {
  title: string;
  hints: T[];
}

export type QueryHintSection = QueryHintSectionBase<QueryHint>
export interface QueryHint {
  title: string;
  queryExpr: string;
  example: string;
  description?: string;
  id?: string;
}
