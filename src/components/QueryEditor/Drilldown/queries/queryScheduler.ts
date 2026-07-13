import { from, isObservable, Observable } from 'rxjs';

import { DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

/**
 * Upper bound of drilldown queries in flight at once. The drawer starts many range-wide scans
 * for per-row volumes, patterns and samples, and an uncapped burst of those can overload the
 * VictoriaLogs backend on a large time range
 */
const DRILLDOWN_MAX_CONCURRENT_QUERIES = 6;

type Task = () => void;

/**
 * FIFO concurrency limiter over cold observables. Once subscribed, the observable `schedule`
 * returns waits for a free slot before it subscribes to the factory's observable.
 * Unsubscribing a queued task removes it from the queue. Unsubscribing a running one cancels
 * it, which aborts the HTTP request, and hands its slot to the next queued task
 */
export class QueryScheduler {
  private running = 0;
  private queue: Task[] = [];

  constructor(private readonly maxConcurrent: number) {}

  schedule<T>(factory: () => Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      // a started task releases its slot exactly once, on whichever comes first: an error,
      // a complete, or an unsubscribe while it runs
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
          // the task never started, so there is nothing to cancel and no slot to free
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
      // the freed slot goes straight to the next queued task, so `running` stays as it is
      next();
    } else {
      this.running--;
    }
  }
}

/** Every drilldown query shares one limiter, so the cap applies per browser tab, not per view */
export const drilldownQueryScheduler = new QueryScheduler(DRILLDOWN_MAX_CONCURRENT_QUERIES);

/**
 * Runs a drilldown request through the shared scheduler. The datasource call waits for a free
 * slot, so a query whose subscriber disappears first, on a page flip, a tab switch or a filter
 * change, never reaches the backend
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
