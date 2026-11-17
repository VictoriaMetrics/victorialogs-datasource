import { defer, finalize, Observable, switchMap, tap } from 'rxjs';

import { CoreApp, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { isSplittableByTime } from '../modifyQuery';
import { Query, QueryType } from '../types';
import { SECOND_MS } from '../utils/time/constants';

import { BarsLoading, LoadBarLogs, noBarLogs, queryHitsAfterLogs, queryHitsByBars, RegisterJob, RunQuery } from './incrementalHits';
import { IncrementalHitsLoadingRuns } from './incrementalHitsLoadingRuns';
import { isIncrementalHitsLoadingEnabled } from './incrementalHitsOption';
import { loadBarLogs, queryLogsWithHandOff, visibleTargets } from './incrementalLogs';
import { LogsCollector } from './logsCollector';
import { LogsHandOff } from './logsHandOff';
import { getVolumeBars } from './volumeBucketing';

/** How long VictoriaLogs may take to start answering a one-shot request before the backend gives it up and the volume goes bar by bar */
export const INCREMENTAL_HITS_TIMEOUT_MS = 3 * SECOND_MS;

export interface IncrementalHitsLoadingOptions {
  /** The first byte budget of the one-shot requests; without it the logs are never handed over and the volume is a single request */
  timeoutMs?: number;
  /** Where a bar-by-bar job registers its controller for the status row of its pane */
  runs: IncrementalHitsLoadingRuns;
  /** Resolves the template variables of an expression, as the request will carry it */
  interpolate: (expr: string) => string;
}

/**
 * The two streams of one Explore run. The logs go first; the volume waits for their
 * outcome and skips its request after failed logs. With a budget, logs the backend gave
 * up give way to the bar-by-bar volume, which loads the logs of every bar after its hits.
 * Logs that cannot be loaded part by part are requested again after the volume
 */
export interface LogsGate {
  /** `run` sends the logs request, and once more after a volume that collected no logs */
  logs(run: RunQuery): Observable<DataQueryResponse>;
  /** The hits of the volume request, started once the logs settle; `run` also sends the logs requests of the bars */
  volume(request: DataQueryRequest<Query>, run: RunQuery): Observable<DataQueryResponse>;
}

/** A gate for an Explore run of visible Raw Logs queries; without the budget when a visible target has the option switched off */
export function openLogsGate(request: DataQueryRequest<Query>, options: IncrementalHitsLoadingOptions): LogsGate | undefined {
  const visible = visibleTargets(request);
  if (!isExploreRawLogsRequest(request, visible)) {
    return undefined;
  }
  const timeoutMs = visible.every(isIncrementalHitsLoadingEnabled) ? options.timeoutMs : undefined;
  // the pane finds its job by the request that started it
  const registerJob: RegisterJob = (controller) => options.runs.register(request.requestId, controller);
  const logsByBars = visible.every((query) => isSplittableByTime(options.interpolate(query.expr)));
  return createLogsGate(request, timeoutMs, registerJob, logsByBars);
}

/** Live tailing is excluded: Explore runs no volume for it and its stream never completes */
const isExploreRawLogsRequest = (request: DataQueryRequest<Query>, visible: Query[]): boolean =>
  request.app === CoreApp.Explore && !request.liveStreaming && visible.length > 0 && visible.every(isRawLogsQuery);

/** Supporting queries (the volume itself, infinite scroll) are requests of their own and never open a gate */
const isRawLogsQuery = (query: Query): boolean =>
  query.queryType === QueryType.Instant && query.supportingQueryType === undefined;

function createLogsGate(request: DataQueryRequest<Query>, timeoutMs: number | undefined, registerJob: RegisterJob, logsByBars: boolean): LogsGate {
  const handOff = new LogsHandOff();
  let logsClaimed = false;
  return {
    logs: (run) => queryLogsWithHandOff(request, run, handOff, timeoutMs),
    volume: (volumeRequest, run) =>
      defer(() => {
        // the targets of the logs request are prepared by now: they carry the sort direction and the line limit
        const targets = visibleTargets(request);
        // only the first subscription feeds the logs: a later one (the volume panel expanded again) finds the hand-off over
        const collector = logsByBars && !logsClaimed ? new LogsCollector(targets) : undefined;
        logsClaimed = true;
        const byBars = (loadLogs: LoadBarLogs) => () =>
          queryHitsByBars(run, volumeRequest, getVolumeBars(volumeRequest, targets[0]?.direction ?? 'desc'), registerJob, loadLogs);
        const bars: BarsLoading = {
          withLogs: byBars(collector ? loadBarLogs(collector, request, run, handOff) : noBarLogs),
          hitsOnly: byBars(noBarLogs),
        };
        return handOff.outcome$.pipe(
          switchMap((outcome) => queryHitsAfterLogs(outcome, run, volumeRequest, timeoutMs, bars)),
          // a volume that got through hands over the logs it collected
          tap({ complete: () => handOff.finishVolume(collector?.logs) }),
          // finalize: logs held in Streaming are released on error and cancellation too, to be requested again
          finalize(() => handOff.finishVolume())
        );
      }),
  };
}
