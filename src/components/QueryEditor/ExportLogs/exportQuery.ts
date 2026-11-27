import { AdHocVariableFilter, PanelData, ScopedVars } from '@grafana/data';

import { Query } from '../../../types';

import { ExportQuery } from './types';

/** What the export needs of the datasource */
export interface ExportQuerySource {
  applyTemplateVariables(target: Query, scopedVars: ScopedVars, adhocFilters?: AdHocVariableFilter[]): Query;
}

/** Resolves the query as a data request does, so the file has the logs of the query that the panel shows */
export const resolveExportQuery = (datasource: ExportQuerySource, query: Query, panelData?: PanelData): ExportQuery => {
  const scopedVars = panelData?.request?.scopedVars ?? {};
  const applied = datasource.applyTemplateVariables(query, scopedVars, panelData?.request?.filters);
  return {
    expr: applied.expr,
    intervalMs: panelData?.request?.intervalMs,
    extraFilters: applied.extraFilters,
    extraStreamFilters: applied.extraStreamFilters,
  };
};
