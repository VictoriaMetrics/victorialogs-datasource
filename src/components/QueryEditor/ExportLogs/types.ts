export type ExportFormat = 'jsonl' | 'csv';

/** The query that the export sends: variables are resolved, the filters are serialized as the backend expects them */
export interface ExportQuery {
  expr: string;
  extraFilters?: string;
  extraStreamFilters?: string;
}
