import { catchError, concat, defer, EMPTY, finalize, map, Observable, of, switchMap, tap, timer } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, LoadingState } from '@grafana/data';

import { emptyLogsFrame } from '../transformers/utils/frame/frameUtils';
import { Query } from '../types';
import { failOnResponseError, responseErrors } from '../utils/dataQueryResponse';

import { isSlowResponse, withFirstByteTimeout } from './firstByteTimeout';
import { BarLogsResult, LoadBarLogs, RunQuery } from './incrementalHits';
import { LogsCollector } from './logsCollector';
import { LogsHandOff } from './logsHandOff';
import { refIdsWithHits } from './volumeHits';

/**
 * The raw logs of a run: an empty frame first, then the response, reported as `Streaming`
 * while a waiting volume loads. With a budget and a volume already waiting, the request
 * carries the budget; given up by the backend, the logs are the ones the volume collects
 * with its bars, or are requested again once a volume that collected none is done
 */
export function queryLogsWithHandOff(
  request: DataQueryRequest<Query>,
  run: RunQuery,
  handOff: LogsHandOff,
  timeoutMs: number | undefined
): Observable<DataQueryResponse> {
  // decided when the request goes out: by then Explore has subscribed the volume, if it shows one
  const firstAttempt = defer(() => run(timeoutMs !== undefined && handOff.volumeWaits ? withFirstByteTimeout(request, timeoutMs) : request));
  const afterSlow = () => {
    handOff.settle('slow');
    return concat(
      handOff.barLogs$.pipe(map((data) => ({ data, state: LoadingState.Streaming }))),
      handOff.volumeDone$.pipe(switchMap((collected) => (collected ? of({ data: collected, state: LoadingState.Done }) : run(request))))
    );
  };

  return concat(
    emptyFirst(request),
    firstAttempt.pipe(switchMap((response) => (isSlowResponse(response) ? afterSlow() : holdWhileVolumeLoads(response, handOff))))
  ).pipe(
    // an error or a cancellation before the response counts as failed logs
    finalize(() => handOff.settle('failed'))
  );
}

/**
 * Explore shows the previous result until the first packet, so an empty frame clears it.
 * A tick later: Grafana's runRequest subscribes to the shared stream twice, and a
 * synchronous first packet would reset it in between
 */
const emptyFirst = (request: DataQueryRequest<Query>): Observable<DataQueryResponse> =>
  timer(0).pipe(map(() => ({ data: visibleTargets(request).map((target) => emptyLogsFrame(target.refId)), state: LoadingState.Streaming })));

/** The targets of the request that are sent to the backend */
export const visibleTargets = (request: DataQueryRequest<Query>): Query[] => request.targets.filter((target) => !target.hide);

/** A failed response passes as is; a good one stays `Streaming` while a waiting volume loads, so the Explore Cancel button covers both */
function holdWhileVolumeLoads(response: DataQueryResponse, handOff: LogsHandOff): Observable<DataQueryResponse> {
  const failed = responseErrors(response).length > 0;
  const volumeWaits = handOff.settle(failed ? 'failed' : 'fast');
  if (failed || !volumeWaits) {
    return of(response);
  }
  return concat(
    of({ ...response, state: LoadingState.Streaming }),
    handOff.volumeDone$.pipe(map(() => ({ ...response, state: LoadingState.Done })))
  );
}

/** The step of a bar-by-bar volume that collects the logs of its bars and shows them through the hand-off */
export function loadBarLogs(collector: LogsCollector, request: DataQueryRequest<Query>, run: RunQuery, handOff: LogsHandOff): LoadBarLogs {
  return (bar, hits) => {
    const targets = collector.targetsMissingLogs(refIdsWithHits(hits));
    if (!targets.length) {
      return EMPTY;
    }
    return run({ ...request, range: bar, targets }).pipe(
      failOnResponseError,
      tap((response) => {
        collector.add(response.data);
        handOff.pushLogs(collector.logs);
      }),
      map((): BarLogsResult => collector.progress),
      catchError((error) => {
        handOff.failLogs(error);
        return of<BarLogsResult>('failed');
      })
    );
  };
}
