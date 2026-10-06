import { concat, defer, finalize, map, Observable, of, scan, switchMap, takeUntil, tap } from 'rxjs';

import { DataFrame, DataQueryRequest, DataQueryResponse, LoadingState, TimeRange } from '@grafana/data';

import { Query } from '../types';

import { IncrementalHitsLoadingController } from './IncrementalHitsLoadingController';
import { isSlowResponse, withFirstByteTimeout } from './firstByteTimeout';
import { LogsOutcome } from './logsHandOff';
import { getVolumeBars } from './volumeBucketing';

export type RunQuery = (request: DataQueryRequest<Query>) => Observable<DataQueryResponse>;

/** Makes the controller of a job reachable for the query editor; the returned function takes it away again */
export type RegisterJob = (controller: IncrementalHitsLoadingController) => () => void;

/**
 * Loads the volume bar by bar. Every bar response is emitted with the frames accumulated
 * so far as `Streaming`; the last emission is `Done`. The job has a controller of its own
 * for the time it runs: it reports every bar there, waits at its gate while paused and
 * completes early with the bars loaded so far when stopped
 */
export function queryHitsByBars(
  run: RunQuery,
  request: DataQueryRequest<Query>,
  bars: TimeRange[],
  registerJob: RegisterJob
): Observable<DataQueryResponse> {
  return defer(() => {
    let accumulated: DataFrame[] = [];
    const controller = new IncrementalHitsLoadingController(bars.length);
    const release = registerJob(controller);

    const streaming = concat(...bars.map((bar) => controller.gate$.pipe(switchMap(() => run({ ...request, range: bar }))))).pipe(
      tap(() => controller.barLoaded()),
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

/** The hits of the volume once the logs settled: none after failed logs, bars at once after slow ones, one shot under the budget after fast ones */
export function queryHitsAfterLogs(
  outcome: LogsOutcome,
  run: RunQuery,
  request: DataQueryRequest<Query>,
  timeoutMs: number | undefined,
  registerJob: RegisterJob
): Observable<DataQueryResponse> {
  if (outcome === 'failed') {
    // an empty Done rather than EMPTY: the volume panel leaves its loading state only on a packet
    return of({ data: [], state: LoadingState.Done });
  }
  const byBars = () => queryHitsByBars(run, request, getVolumeBars(request), registerJob);
  if (outcome === 'slow') {
    return byBars();
  }
  if (timeoutMs === undefined) {
    return run(request);
  }
  return run(withFirstByteTimeout(request, timeoutMs)).pipe(switchMap((response) => (isSlowResponse(response) ? byBars() : of(response))));
}
