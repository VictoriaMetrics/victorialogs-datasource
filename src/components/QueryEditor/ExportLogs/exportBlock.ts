import { isEqual } from 'lodash';

import { LoadingState, PanelData } from '@grafana/data';

import { Query } from '../../../types';

export const QUERY_ERROR_BLOCK = 'Fix the query error to download logs';
export const QUERY_NOT_RUN_BLOCK = 'Run the query to download logs';

const isSameExport = (query: Query, lastRunQuery: Query): boolean =>
  query.expr === lastRunQuery.expr &&
  isEqual(query.adHocFilters ?? [], lastRunQuery.adHocFilters ?? []) &&
  isEqual(query.streamFilters ?? [], lastRunQuery.streamFilters ?? []);

/** Returns why the export is not available, so the file always has the logs of the query that the panel shows */
export const getExportBlock = (query: Query, panelData?: PanelData): string | undefined => {
  const targets = (panelData?.request?.targets ?? []) as Query[];
  const lastRunQuery = targets.find((target) => target.refId === query.refId);
  if (!lastRunQuery || !isSameExport(query, lastRunQuery)) {
    return QUERY_NOT_RUN_BLOCK;
  }
  if (panelData?.state === LoadingState.Error) {
    return QUERY_ERROR_BLOCK;
  }
  return undefined;
};
