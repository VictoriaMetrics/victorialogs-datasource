import { concat, defer, finalize, map, Observable, of, scan, switchMap, takeUntil, tap } from 'rxjs';

import { DataFrame, DataQueryRequest, DataQueryResponse, LoadingState, TimeRange } from '@grafana/data';

import { Query } from '../types';

import { IncrementalHitsLoadingController } from './IncrementalHitsLoadingController';

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
