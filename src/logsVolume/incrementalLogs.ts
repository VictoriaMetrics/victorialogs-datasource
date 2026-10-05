import { concat, defer, EMPTY, filter, finalize, map, NEVER, Observable, of, switchMap, takeUntil, tap, timer } from 'rxjs';

import { DataFrame, DataQueryResponse, FieldType, LoadingState } from '@grafana/data';

import { FrameField } from '../transformers/types';
import { responseErrors } from '../utils/dataQueryResponse';

import { LogsHandOff } from './logsHandOff';

/**
 * The raw logs of a run: an empty frame first, then the response, reported as `Streaming`
 * while a waiting volume loads. Past the timeout the logs count as slow; when a volume
 * waits for them they are cut and requested again once the volume is done
 */
export function queryLogsWithHandOff(
  run: () => Observable<DataQueryResponse>,
  handOff: LogsHandOff,
  refIds: string[],
  timeoutMs: number | undefined
): Observable<DataQueryResponse> {
  let handedOver = false;
  const handOver = timeoutMs === undefined ? NEVER : timer(timeoutMs).pipe(
    // slow either way; cut only when a volume waits, otherwise the result would be lost for nothing
    map(() => handOff.settle('slow')),
    tap((cut) => (handedOver = cut)),
    filter(Boolean)
  );

  return concat(
    emptyFirst(refIds),
    run().pipe(switchMap((response) => holdWhileVolumeLoads(response, handOff)), takeUntil(handOver)),
    defer(() => (handedOver ? handOff.volumeDone$.pipe(switchMap(() => run())) : EMPTY))
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
const emptyFirst = (refIds: string[]): Observable<DataQueryResponse> =>
  timer(0).pipe(map(() => ({ data: refIds.map(emptyLogsFrame), state: LoadingState.Streaming })));

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

/** A logs frame without rows; Explore recognises a logs result by `preferredVisualisationType` and the Time/Line field pair */
export const emptyLogsFrame = (refId: string): DataFrame => ({
  refId,
  length: 0,
  fields: [
    { name: 'Time', type: FieldType.time, config: {}, values: [] },
    { name: FrameField.Line, type: FieldType.string, config: {}, values: [] },
  ],
  meta: { preferredVisualisationType: 'logs' },
});
