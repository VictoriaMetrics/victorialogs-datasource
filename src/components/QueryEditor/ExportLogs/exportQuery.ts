import { AdHocVariableFilter, PanelData, ScopedVars } from '@grafana/data';

import { Query } from '../../../types';

import { ExportQuery } from './types';

/** What the export needs of the datasource */
export interface ExportQuerySource {
  applyTemplateVariables(target: Query, scopedVars: ScopedVars, adhocFilters?: AdHocVariableFilter[]): Query;
}

const INTERVAL_MS_VARIABLE = '$__interval_ms';
const INTERVAL_VARIABLE = '$__interval';

const replaceVariable = (expr: string, variable: string, value: unknown): string => {
  if (value === undefined || value === null) {
    return expr;
  }
  return expr.split(variable).join(String(value));
};

// applyTemplateVariables keeps the interval variables for the backend of a data query.
// The export resource gets no interval, so the values of the last request replace them here
const replaceIntervalVariables = (expr: string, scopedVars: ScopedVars): string => {
  const withIntervalMs = replaceVariable(expr, INTERVAL_MS_VARIABLE, scopedVars.__interval_ms?.value);
  return replaceVariable(withIntervalMs, INTERVAL_VARIABLE, scopedVars.__interval?.value);
};

/** Resolves the query as a data request does, so the file has the logs of the query that the panel shows */
export const resolveExportQuery = (datasource: ExportQuerySource, query: Query, panelData?: PanelData): ExportQuery => {
  const scopedVars = panelData?.request?.scopedVars ?? {};
  const applied = datasource.applyTemplateVariables(query, scopedVars, panelData?.request?.filters);
  return {
    expr: replaceIntervalVariables(applied.expr, scopedVars),
    extraFilters: applied.extraFilters,
    extraStreamFilters: applied.extraStreamFilters,
  };
};
