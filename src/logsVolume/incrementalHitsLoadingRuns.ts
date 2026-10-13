import { memoize } from 'lodash';
import { BehaviorSubject, distinctUntilChanged, map, Observable, of, switchMap } from 'rxjs';

import { IncrementalHitsLoadingController, IncrementalHitsLoadingState } from './IncrementalHitsLoadingController';

/** The running job of a pane as the status row sees it */
export interface IncrementalHitsLoadingJob {
  controller: IncrementalHitsLoadingController;
  state: IncrementalHitsLoadingState;
}

/**
 * The running bar-by-bar jobs of one datasource, keyed by Explore pane. The pane is known
 * by its request id: Explore keeps it for the lifetime of the pane and hands it to the query
 * editor in `data.request`, so the status row of a pane controls the job of that pane only
 */
export class IncrementalHitsLoadingRuns {
  private readonly runs = new BehaviorSubject(new Map<string, IncrementalHitsLoadingController>());

  /** Registers the job started by the request; the returned function releases it */
  register(requestId: string, controller: IncrementalHitsLoadingController): () => void {
    const key = paneKey(requestId);
    this.runs.value.set(key, controller);
    this.runs.next(this.runs.value);
    return () => {
      // a new run of the pane may have replaced the job already
      if (this.runs.value.get(key) === controller) {
        this.runs.value.delete(key);
        this.runs.next(this.runs.value);
      }
    };
  }

  /** The running job of the pane with this request id and its live state; undefined without a job */
  job$(requestId: string | undefined): Observable<IncrementalHitsLoadingJob | undefined> {
    return this.runs.pipe(
      map((runs) => (requestId === undefined ? undefined : runs.get(paneKey(requestId)))),
      distinctUntilChanged(),
      switchMap((controller) => (controller ? controller.state$.pipe(map((state) => ({ controller, state }))) : of(undefined)))
    );
  }
}

/** The mixed datasource prefixes the request id of every sub-request; the pane is the request behind it */
const paneKey = (requestId: string): string => requestId.replace(/^mixed-\d+-/, '');

/** The run registry shared by every instance of the datasource with the given uid */
export const getIncrementalHitsLoadingRuns = memoize((_datasourceUid: string) => new IncrementalHitsLoadingRuns());
