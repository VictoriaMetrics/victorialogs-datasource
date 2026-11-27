export type ExportFormat = 'jsonl' | 'csv';

/**
 * The query that the export sends: variables are resolved, the filters are serialized as the backend expects them.
 * The backend replaces the interval and range variables, as it does for a data query
 */
export interface ExportQuery {
  expr: string;
  intervalMs?: number;
  extraFilters?: string;
  extraStreamFilters?: string;
}
