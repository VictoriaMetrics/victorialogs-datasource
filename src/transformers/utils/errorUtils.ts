import { DataQueryError } from '@grafana/data';

import { Query } from '../../types';

export function improveError(error: DataQueryError | undefined, queryMap: Map<string, Query>): DataQueryError | undefined {
  if (error === undefined) {
    return error;
  }

  const { refId, message } = error;
  if (refId === undefined || message === undefined) {
    return error;
  }

  const query = queryMap.get(refId);
  if (query === undefined) {
    return error;
  }

  if (message.includes('escape') && query.expr.includes('\\')) {
    return {
      ...error,
      message: `${message}. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://docs.victoriametrics.com/victorialogs/logsql/.`,
    };
  }

  return error;
}
