import { catchError, concat, concatMap, defer, EMPTY, finalize, ignoreElements, map, Observable, of, scan, switchMap, takeUntil, tap } from 'rxjs';

import { DataFrame, DataQueryRequest, DataQueryResponse, LoadingState, TimeRange } from '@grafana/data';

import { Query } from '../types';
import { failOnResponseError } from '../utils/dataQueryResponse';

import { IncrementalHitsLoadingController, LogsProgress } from './IncrementalHitsLoadingController';
import { isSlowResponse, withFirstByteTimeout } from './firstByteTimeout';
import { LogsOutcome } from './logsHandOff';
import { VolumeBars } from './volumeBucketing';

export type RunQuery = (request: DataQueryRequest<Query>) => Observable<DataQueryResponse>;

/** Makes the controller of a job reachable for the query editor; the returned function takes it away again */
export type RegisterJob = (controller: IncrementalHitsLoadingController) => () => void;

/** Loads the logs of a bar from its hits; emits the progress once they are collected, nothing when the bar needs no logs */
export type LoadBarLogs = (bar: TimeRange, hits: DataQueryResponse) => Observable<LogsProgress[]>;

export const noBarLogs: LoadBarLogs = () => EMPTY;

/**
 * Loads the volume bar by bar, the logs of every bar right after its hits. Every bar
 * response is emitted with the frames accumulated so far as `Streaming`; the last emission
 * is `Done`. The job has a controller of its own for the time it runs: it reports every bar
 * there, waits at its gate while paused and completes early with the bars loaded so far
 * when stopped or when the logs of a bar fail
 */
export function queryHitsByBars(
  run: RunQuery,
  request: DataQueryRequest<Query>,
  bars: VolumeBars,
  registerJob: RegisterJob,
  loadLogs: LoadBarLogs
): Observable<DataQueryResponse> {
  return defer(() => {
    let accumulated: DataFrame[] = [];
    const controller = new IncrementalHitsLoadingController({ totalBars: bars.ranges.length, step: bars.step });
    const release = registerJob(controller);

    const stopJob = () => {
      controller.stop();
      return EMPTY;
    };
    const collectLogs = (bar: TimeRange, hits: DataQueryResponse) =>
      loadLogs(bar, hits).pipe(
        tap((progress) => controller.logsLoaded(progress)),
        catchError(stopJob),
        ignoreElements()
      );
    const loadBar = (bar: TimeRange) =>
      controller.gate$.pipe(
        switchMap(() => run({ ...request, range: bar })),
        failOnResponseError,
        tap(() => controller.barLoaded()),
        concatMap((hits) => concat(of(hits), collectLogs(bar, hits)))
      );

    const streaming = concat(...bars.ranges.map(loadBar)).pipe(
      scan((acc, response) => acc.concat(response.data), accumulated),
      tap((data) => (accumulated = data)),
      map((data) => ({ data, state: LoadingState.Streaming })),
      takeUntil(controller.stopped$)
    );

    return concat(
      streaming,
      defer(() => of({ data: accumulated, state: LoadingState.Done }))
    ).pipe(finalize(release));
  });
}

/** The hits of the volume once the logs settled: none after failed logs, bars with their logs at once after slow ones, one shot under the budget after fast ones */
export function queryHitsAfterLogs(
  outcome: LogsOutcome,
  run: RunQuery,
  request: DataQueryRequest<Query>,
  timeoutMs: number | undefined,
  byBars: (loadLogs: LoadBarLogs) => Observable<DataQueryResponse>,
  loadLogs: LoadBarLogs
): Observable<DataQueryResponse> {
  if (outcome === 'failed') {
    // an empty Done rather than EMPTY: the volume panel leaves its loading state only on a packet
    return of({ data: [], state: LoadingState.Done });
  }
  if (outcome === 'slow') {
    return byBars(loadLogs);
  }
  if (timeoutMs === undefined) {
    return run(request);
  }
  return run(withFirstByteTimeout(request, timeoutMs)).pipe(switchMap((response) => (isSlowResponse(response) ? byBars(noBarLogs) : of(response))));
}
