import { DataFrame, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { Query } from '../types';

/** A copy of the request whose targets carry the budget for VictoriaLogs to start answering */
export const withFirstByteTimeout = (request: DataQueryRequest<Query>, timeoutMs: number): DataQueryRequest<Query> => ({
  ...request,
  targets: request.targets.map((target) => ({ ...target, firstByteTimeoutMs: timeoutMs })),
});

/** Whether the backend gave the request up at its budget and returned the marker frame instead of a result */
export const isSlowResponse = (response: DataQueryResponse): boolean =>
  response.data.some((frame: DataFrame) => frame.meta?.custom?.slowQuery === true);

/** The marker frame the backend returns for a query given up at its budget */
export const slowQueryFrame = (refId: string): DataFrame => ({ refId, fields: [], length: 0, meta: { custom: { slowQuery: true } } });
