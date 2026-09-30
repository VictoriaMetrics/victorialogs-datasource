import { AsyncSubject, concat, finalize, map, MonoTypeOperatorFunction, Observable, of, switchMap } from 'rxjs';

import { CoreApp, DataQueryRequest, DataQueryResponse, LoadingState } from '@grafana/data';

import { Query, QueryType } from '../types';
import { responseErrors } from '../utils/dataQueryResponse';

type LogsOutcome = 'ok' | 'failed';

/**
 * Hand-off between the two independent Explore streams of one query run. The volume
 * waits for the raw logs and skips the hits request after failed logs (Explore hides the
 * logs section, and the volume in it, anyway). While the volume loads, the logs response
 * is held in `Streaming`, so the Explore Run/Cancel button stays on Cancel and cancels
 * both requests
 */
export interface LogsGate {
  /** Operator for the raw logs stream */
  logs(): MonoTypeOperatorFunction<DataQueryResponse>;
  /** Runs the hits request once the logs are done */
  volume(run: () => Observable<DataQueryResponse>): Observable<DataQueryResponse>;
}

/** A gate for an Explore run of visible Raw Logs queries; undefined for every other request */
export function openLogsGate(request: DataQueryRequest<Query>): LogsGate | undefined {
  return isExploreRawLogsRequest(request) ? createLogsGate() : undefined;
}

// supporting queries (the volume itself, infinite scroll) are requests of their own and never open a gate
const isExploreRawLogsRequest = (request: DataQueryRequest<Query>): boolean => {
  const visible = request.targets.filter((query) => !query.hide);
  return request.app === CoreApp.Explore && !request.liveStreaming && visible.length > 0 && visible.every(isRawLogsQuery);
};

const isRawLogsQuery = (query: Query): boolean =>
  query.queryType === QueryType.Instant && query.supportingQueryType === undefined;

function createLogsGate(): LogsGate {
  // both fire once and replay to late subscribers; a completed AsyncSubject ignores later values
  const logsDone = new AsyncSubject<LogsOutcome>();
  const volumeDone = new AsyncSubject<void>();
  const releaseLogs = (outcome: LogsOutcome) => {
    logsDone.next(outcome);
    logsDone.complete();
  };

  return {
    logs: () => (source) =>
      source.pipe(
        switchMap((response) => {
          // read before releasing: releasing lets the waiting volume subscriber go
          const volumeWaits = logsDone.observed;
          const failed = responseErrors(response).length > 0;
          releaseLogs(failed ? 'failed' : 'ok');
          if (failed || !volumeWaits) {
            return of(response);
          }
          return concat(
            of({ ...response, state: LoadingState.Streaming }),
            volumeDone.pipe(map(() => ({ ...response, state: LoadingState.Done })))
          );
        }),
        // an error or a cancellation before the response
        finalize(() => releaseLogs('failed'))
      ),

    volume: (run) =>
      logsDone.pipe(
        switchMap((outcome) => (outcome === 'ok' ? run() : of({ data: [], state: LoadingState.Done }))),
        finalize(() => {
          volumeDone.next();
          volumeDone.complete();
        })
      ),
  };
}
