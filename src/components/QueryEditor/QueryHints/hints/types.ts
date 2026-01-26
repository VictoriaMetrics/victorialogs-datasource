export interface QueryHints {
  sections: QueryHintSection[];
}

export interface QueryHintSection {
  title: string;
  hints: QueryHint[];
}

export interface QueryHint {
  title: string;
  queryExpr: string;
  example: string;
  description?: string;
  id?: string;
}
