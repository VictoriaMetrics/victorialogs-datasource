import { concat, defer, finalize, map, Observable, of, switchMap, timer } from 'rxjs';

import { DataFrame, DataQueryRequest, DataQueryResponse, FieldType, LoadingState } from '@grafana/data';

import { FrameField } from '../transformers/types';
import { Query } from '../types';
import { responseErrors } from '../utils/dataQueryResponse';

import { isSlowResponse, withFirstByteTimeout } from './firstByteTimeout';
import { RunQuery } from './incrementalHits';
import { LogsHandOff } from './logsHandOff';

/**
 * The raw logs of a run: an empty frame first, then the response, reported as `Streaming`
 * while a waiting volume loads. With a budget and a volume already waiting, the request
 * carries the budget; given up by the backend, the logs are requested again once the
 * volume is done
 */
export function queryLogsWithHandOff(
  request: DataQueryRequest<Query>,
  run: RunQuery,
  handOff: LogsHandOff,
  timeoutMs: number | undefined
): Observable<DataQueryResponse> {
  // decided when the request goes out: by then Explore has subscribed the volume, if it shows one
  const firstAttempt = defer(() => run(timeoutMs !== undefined && handOff.volumeWaits ? withFirstByteTimeout(request, timeoutMs) : request));
  const afterVolume = () => {
    handOff.settle('slow');
    return handOff.volumeDone$.pipe(switchMap(() => run(request)));
  };

  return concat(
    emptyFirst(request),
    firstAttempt.pipe(switchMap((response) => (isSlowResponse(response) ? afterVolume() : holdWhileVolumeLoads(response, handOff))))
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
  timer(0).pipe(
    map(() => ({ data: request.targets.filter((target) => !target.hide).map((target) => emptyLogsFrame(target.refId)), state: LoadingState.Streaming }))
  );

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
