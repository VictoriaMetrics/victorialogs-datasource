import { finalize, Observable, switchMap } from 'rxjs';

import { CoreApp, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { Query, QueryType } from '../types';
import { SECOND_MS } from '../utils/time/constants';

import { queryHitsAfterLogs, RegisterJob, RunQuery } from './incrementalHits';
import { IncrementalHitsLoadingRuns } from './incrementalHitsLoadingRuns';
import { isIncrementalHitsLoadingEnabled } from './incrementalHitsOption';
import { queryLogsWithHandOff } from './incrementalLogs';
import { LogsHandOff } from './logsHandOff';

/** How long VictoriaLogs may take to start answering a one-shot request before the backend gives it up and the volume goes bar by bar */
export const INCREMENTAL_HITS_TIMEOUT_MS = 3 * SECOND_MS;

export interface IncrementalHitsLoadingOptions {
  /** The first byte budget of the one-shot requests; without it the logs are never handed over and the volume is a single request */
  timeoutMs?: number;
  /** Where a bar-by-bar job registers its controller for the status row of its pane */
  runs: IncrementalHitsLoadingRuns;
}

/**
 * The two streams of one Explore run. The logs go first; the volume waits for their
 * outcome and skips its request after failed logs. With a budget, logs the backend gave
 * up give way to the bar-by-bar volume and are requested again after it
 */
export interface LogsGate {
  /** `run` sends the logs request, and once more after a hand-over */
  logs(run: RunQuery): Observable<DataQueryResponse>;
  /** The hits of the volume request, started once the logs settle */
  volume(request: DataQueryRequest<Query>, run: RunQuery): Observable<DataQueryResponse>;
}

/** A gate for an Explore run of visible Raw Logs queries; without the budget when a visible target has the option switched off */
export function openLogsGate(request: DataQueryRequest<Query>, options: IncrementalHitsLoadingOptions): LogsGate | undefined {
  const visible = request.targets.filter((query) => !query.hide);
  if (!isExploreRawLogsRequest(request, visible)) {
    return undefined;
  }
  const timeoutMs = visible.every(isIncrementalHitsLoadingEnabled) ? options.timeoutMs : undefined;
  // the pane finds its job by the request that started it
  const registerJob: RegisterJob = (controller) => options.runs.register(request.requestId, controller);
  return createLogsGate(request, timeoutMs, registerJob);
}

/** Live tailing is excluded: Explore runs no volume for it and its stream never completes */
const isExploreRawLogsRequest = (request: DataQueryRequest<Query>, visible: Query[]): boolean =>
  request.app === CoreApp.Explore && !request.liveStreaming && visible.length > 0 && visible.every(isRawLogsQuery);

/** Supporting queries (the volume itself, infinite scroll) are requests of their own and never open a gate */
const isRawLogsQuery = (query: Query): boolean =>
  query.queryType === QueryType.Instant && query.supportingQueryType === undefined;

function createLogsGate(request: DataQueryRequest<Query>, timeoutMs: number | undefined, registerJob: RegisterJob): LogsGate {
  const handOff = new LogsHandOff();
  return {
    logs: (run) => queryLogsWithHandOff(request, run, handOff, timeoutMs),
    volume: (volumeRequest, run) =>
      handOff.outcome$.pipe(
        switchMap((outcome) => queryHitsAfterLogs(outcome, run, volumeRequest, timeoutMs, registerJob)),
        // finalize: logs held in Streaming are released on success, error and cancellation alike
        finalize(() => handOff.finishVolume())
      ),
  };
}
