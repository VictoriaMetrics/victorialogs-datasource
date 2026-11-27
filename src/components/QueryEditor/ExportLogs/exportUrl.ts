import { EXPORT_LOGS_RESOURCE } from './constants';
import { ExportFormat, ExportQuery } from './types';

interface ExportUrlParams {
  datasourceUid: string;
  exportQuery: ExportQuery;
  startMs: number;
  endMs: number;
  format: ExportFormat;
}

/** The URL is relative, so the browser resolves it against the base URL of Grafana, which can have a sub-path */
export const buildExportUrl = ({ datasourceUid, exportQuery, startMs, endMs, format }: ExportUrlParams): string => {
  const params = new URLSearchParams({
    query: exportQuery.expr,
    start: String(startMs),
    end: String(endMs),
    format,
  });
  if (exportQuery.intervalMs !== undefined) {
    params.set('interval_ms', String(exportQuery.intervalMs));
  }
  if (exportQuery.extraFilters) {
    params.set('extra_filters', exportQuery.extraFilters);
  }
  if (exportQuery.extraStreamFilters) {
    params.set('extra_stream_filters', exportQuery.extraStreamFilters);
  }
  const resourcesUrl = `api/datasources/uid/${encodeURIComponent(datasourceUid)}/resources`;
  return `${resourcesUrl}/${EXPORT_LOGS_RESOURCE}?${params.toString()}`;
};
