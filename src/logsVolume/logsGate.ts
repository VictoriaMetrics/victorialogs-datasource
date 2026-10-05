import { AsyncSubject, concat, defer, EMPTY, filter, finalize, map, NEVER, Observable, of, switchMap, takeUntil, timeout, timer } from 'rxjs';

import { CoreApp, DataFrame, DataQueryRequest, DataQueryResponse, FieldType, LoadingState } from '@grafana/data';

import { FrameField } from '../transformers/types';
import { Query, QueryType } from '../types';
import { responseErrors } from '../utils/dataQueryResponse';
import { SECOND_MS } from '../utils/time/constants';

import { queryHitsByBars, RegisterJob, RunQuery } from './incrementalHits';
import { IncrementalHitsLoadingRuns } from './incrementalHitsLoadingRuns';
import { isIncrementalHitsLoadingEnabled } from './incrementalHitsOption';
import { getVolumeBars } from './volumeBucketing';

/** How long a one-shot request may run: raw logs taking longer count as slow, a hits request taking longer falls back to the bar-by-bar volume */
export const INCREMENTAL_HITS_TIMEOUT_MS = 3 * SECOND_MS;

/** How the raw logs ended: in time, past the timeout, or with an error or a cancellation */
type LogsOutcome = 'fast' | 'slow' | 'failed';

export interface IncrementalHitsLoadingOptions {
  /** The one-shot timeout, see `INCREMENTAL_HITS_TIMEOUT_MS`; without it slow logs are never handed over and the volume is a single request */
  timeoutMs?: number;
  /** Where a bar-by-bar job registers its controller for the status row of its pane */
  runs: IncrementalHitsLoadingRuns;
}

/**
 * Hand-off between the logs and the volume streams of one Explore run. The volume waits
 * for the raw logs and skips its hits request when they failed (an error response carries
 * no logs frame, so Explore hides the logs section, volume included, anyway). While a
 * waiting volume loads, the logs response is emitted at once but reported as `Streaming`,
 * so the Explore Run/Cancel button stays on Cancel and cancels both requests.
 *
 * With a timeout, after fast logs the volume runs one shot under the same timeout before
 * going bar by bar; after slow logs it goes bar by bar at once, and the logs, if a volume
 * waits for them, are cancelled and requested again when the volume is done.
 */
export interface LogsGate {
  /** `run` starts the request and is called a second time after slow logs were handed over to the volume */
  logs(run: () => Observable<DataQueryResponse>): Observable<DataQueryResponse>;
  /** The hits stream of the volume request, started once the logs settle: answered, timed out or failed */
  volume(request: DataQueryRequest<Query>, run: RunQuery): Observable<DataQueryResponse>;
}

/** A gate for an Explore run of visible Raw Logs queries, without the timeout (no hand-over, one-shot volume) when a visible target has the incremental hits loading switched off */
export function openLogsGate(request: DataQueryRequest<Query>, options: IncrementalHitsLoadingOptions): LogsGate | undefined {
  const visible = request.targets.filter((query) => !query.hide);
  if (!isExploreRawLogsRequest(request, visible)) {
    return undefined;
  }
  const timeoutMs = visible.every(isIncrementalHitsLoadingEnabled) ? options.timeoutMs : undefined;
  // the pane finds the job by the request that started it
  const registerJob: RegisterJob = (controller) => options.runs.register(request.requestId, controller);
  return createLogsGate(
    visible.map((query) => query.refId),
    timeoutMs,
    registerJob
  );
}

/** Live tailing is excluded: Explore runs no volume for it and its stream never completes */
const isExploreRawLogsRequest = (request: DataQueryRequest<Query>, visible: Query[]): boolean =>
  request.app === CoreApp.Explore && !request.liveStreaming && visible.length > 0 && visible.every(isRawLogsQuery);

/** Supporting queries (the volume itself, infinite scroll) are requests of their own and never open a gate */
const isRawLogsQuery = (query: Query): boolean =>
  query.queryType === QueryType.Instant && query.supportingQueryType === undefined;

function createLogsGate(refIds: string[], timeoutMs: number | undefined, registerJob: RegisterJob): LogsGate {
  // AsyncSubject: the volume may subscribe before or after the logs settle, and settleLogs runs
  // from several places (the response, the timeout, finalize), only the first of which counts
  const logsOutcome = new AsyncSubject<LogsOutcome>();
  const volumeDone = new AsyncSubject<void>();

  /** Records the outcome and reports whether a volume was waiting for it */
  const settleLogs = (outcome: LogsOutcome): boolean => {
    // `observed` drops to false once the subject completes, so it is read first
    const volumeWaits = logsOutcome.observed;
    logsOutcome.next(outcome);
    logsOutcome.complete();
    return volumeWaits;
  };

  /** Passes a response that came before the hand-over: a failed one as is, a good one reported as `Streaming` until a waiting volume finishes, then repeated as `Done` */
  const holdWhileVolumeLoads = (response: DataQueryResponse): Observable<DataQueryResponse> => {
    const failed = responseErrors(response).length > 0;
    const volumeWaits = settleLogs(failed ? 'failed' : 'fast');
    if (failed || !volumeWaits) {
      return of(response);
    }
    return concat(
      of({ ...response, state: LoadingState.Streaming }),
      volumeDone.pipe(map(() => ({ ...response, state: LoadingState.Done })))
    );
  };

  const logs = (run: () => Observable<DataQueryResponse>): Observable<DataQueryResponse> => {
    // At the timeout the logs count as slow either way (a later volume goes bar by bar at once),
    // but they are cut only when a volume is waiting for them: cutting them otherwise would lose
    // the result for nothing. takeUntil rather than timeout: the cut is conditional and must end
    // the logs quietly, the re-run comes after the volume (see handedOver below)
    let handedOver = false;
    const handOver = timeoutMs === undefined ? NEVER : timer(timeoutMs).pipe(filter(() => (handedOver = settleLogs('slow'))));

    // An empty logs frame first: Explore would otherwise keep showing the previous run's logs
    // until these answer, and it keeps the logs section, with the volume panel in it, on screen
    // while the volume loads ahead of handed-over logs. Sent a tick later, never synchronously:
    // Grafana's runRequest `share()`s the stream and subscribes to it twice, first as the
    // takeUntil notifier of its 200 ms loading-state timer; a synchronous first packet would
    // complete that notifier, drop the refcount to zero and make the second subscription
    // restart the request, with our finalize counting the first one as failed logs
    const emptyFirst = timer(0).pipe(map(() => ({ data: refIds.map(emptyLogsFrame), state: LoadingState.Streaming })));

    return concat(
      emptyFirst,
      run().pipe(switchMap(holdWhileVolumeLoads), takeUntil(handOver)),
      // defer: handedOver is known only once the logs step above has ended
      defer(() => (handedOver ? volumeDone.pipe(switchMap(() => run())) : EMPTY))
    ).pipe(
      // an error or a cancellation before the response counts as failed logs
      finalize(() => settleLogs('failed'))
    );
  };

  const hits = (outcome: LogsOutcome, request: DataQueryRequest<Query>, run: RunQuery): Observable<DataQueryResponse> => {
    if (outcome === 'failed') {
      // an empty Done rather than EMPTY: the volume panel leaves its loading state only on a packet
      return of({ data: [], state: LoadingState.Done });
    }
    const byBars = () => queryHitsByBars(run, request, getVolumeBars(request), registerJob);
    if (outcome === 'slow') {
      return byBars();
    }
    const oneShot = run(request);
    // `first` only: a one-shot request answers once
    return timeoutMs === undefined ? oneShot : oneShot.pipe(timeout({ first: timeoutMs, with: byBars }));
  };

  const volume = (request: DataQueryRequest<Query>, run: RunQuery): Observable<DataQueryResponse> =>
    logsOutcome.pipe(
      switchMap((outcome) => hits(outcome, request, run)),
      // finalize, not complete: logs reported as Streaming must be released on success, error and cancellation alike
      finalize(() => {
        volumeDone.next();
        volumeDone.complete();
      })
    );

  return { logs, volume };
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
