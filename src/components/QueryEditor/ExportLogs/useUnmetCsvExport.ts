import { useAsync } from 'react-use';

import {
  VictoriaLogsRequirement,
  VictoriaLogsSupport,
  victoriaLogsSupportCache,
  VictoriaLogsSupportCache,
  VictoriaLogsSupportSource,
} from '../../../victoriaLogsCompat/victoriaLogsSupport';

import { CSV_EXPORT_REQUIREMENT_ID } from './constants';

/**
 * The CSV requirement when the VictoriaLogs is known to be older than it needs.
 * An unknown version returns undefined: the backend then lists every requirement as unmet, which says nothing about CSV
 */
export const findUnmetCsvExport = (support?: VictoriaLogsSupport): VictoriaLogsRequirement | undefined => {
  if (!support?.versionKnown) {
    return undefined;
  }
  return support.unmet?.find((requirement) => requirement.id === CSV_EXPORT_REQUIREMENT_ID);
};

export const useUnmetCsvExport = (
  datasource: VictoriaLogsSupportSource,
  cache: VictoriaLogsSupportCache = victoriaLogsSupportCache
): VictoriaLogsRequirement | undefined => {
  const { value: support } = useAsync(() => cache.get(datasource), [cache, datasource]);
  return findUnmetCsvExport(support);
};
