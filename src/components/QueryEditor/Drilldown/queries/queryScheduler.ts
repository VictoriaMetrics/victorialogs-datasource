import { from, isObservable, Observable } from 'rxjs';

import { DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

/**
 * Upper bound of drilldown queries in flight at once. The drawer fans out into
 * many range-wide scans (per-row volumes, patterns, samples) — an uncapped burst
 * of those can overload the VictoriaLogs backend on large time ranges
 */
export const DRILLDOWN_MAX_CONCURRENT_QUERIES = 6;

type Task = () => void;

/**
 * FIFO concurrency limiter over cold observables. `schedule` returns an
 * observable that, once subscribed, waits for a free slot before subscribing
 * to the factory's observable. Unsubscribing a queued task removes it from the
 * queue; unsubscribing a running one cancels it (propagating the HTTP abort)
 * and frees its slot for the next queued task.
 */
export class QueryScheduler {
  private running = 0;
  private queue: Task[] = [];

  constructor(private readonly maxConcurrent: number) {}

  schedule<T>(factory: () => Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      // the slot is released exactly once per started task — on error, on
      // complete, or on unsubscribe-while-running, whichever comes first
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          this.finish();
        }
      };

      let innerUnsubscribe: (() => void) | undefined;
      const task: Task = () => {
        try {
          const subscription = factory().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => {
              release();
              subscriber.error(err);
            },
            complete: () => {
              release();
              subscriber.complete();
            },
          });
          innerUnsubscribe = () => subscription.unsubscribe();
        } catch (err) {
          release();
          subscriber.error(err);
        }
      };

      this.enqueue(task);

      return () => {
        if (this.dequeue(task)) {
          // never started — nothing to cancel, no slot to free
          return;
        }
        innerUnsubscribe?.();
        release();
      };
    });
  }

  private enqueue(task: Task): void {
    if (this.running < this.maxConcurrent) {
      this.running++;
      task();
    } else {
      this.queue.push(task);
    }
  }

  /** Removes a not-yet-started task; returns false when the task already started */
  private dequeue(task: Task): boolean {
    const index = this.queue.indexOf(task);
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  private finish(): void {
    const next = this.queue.shift();
    if (next) {
      // the freed slot passes directly to the next queued task
      next();
    } else {
      this.running--;
    }
  }
}

/** All drilldown data queries share one limiter — the cap protects VL per browser tab, not per view */
export const drilldownQueryScheduler = new QueryScheduler(DRILLDOWN_MAX_CONCURRENT_QUERIES);

/**
 * Runs a drilldown request through the shared scheduler. The datasource call is
 * deferred until a slot frees up, so queued queries don't reach the backend at
 * all when their subscriber goes away first (page flip, tab switch, filter change)
 */
export function scheduleDrilldownQuery(
  datasource: VictoriaLogsDatasource,
  request: DataQueryRequest<Query>
): Observable<DataQueryResponse> {
  return drilldownQueryScheduler.schedule(() => {
    const response = datasource.query(request);
    return isObservable(response) ? response : from(Promise.resolve(response));
  });
}
