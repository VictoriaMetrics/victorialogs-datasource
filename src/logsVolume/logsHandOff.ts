import { AsyncSubject, Observable, ReplaySubject } from 'rxjs';

import { DataFrame } from '@grafana/data';

/** How the raw logs ended: in time, past the budget, or with an error or a cancellation */
export type LogsOutcome = 'fast' | 'slow' | 'failed';

/**
 * The signals between the logs and the volume streams of one Explore run. All of them
 * replay, so either side may subscribe before or after the other has settled
 */
export class LogsHandOff {
  private readonly outcome = new AsyncSubject<LogsOutcome>();
  private readonly barLogs = new ReplaySubject<DataFrame[]>(1);
  private readonly volumeDone = new AsyncSubject<DataFrame[] | undefined>();

  readonly outcome$: Observable<LogsOutcome> = this.outcome.asObservable();
  /** The logs a bar-by-bar volume has collected so far; completes with the volume */
  readonly barLogs$: Observable<DataFrame[]> = this.barLogs.asObservable();
  /** Fires when the volume is over, with the logs it collected when it got through its bars */
  readonly volumeDone$: Observable<DataFrame[] | undefined> = this.volumeDone.asObservable();

  /** Whether a volume is subscribed and waiting for the logs to settle */
  get volumeWaits(): boolean {
    // `observed` drops to false once the subject completes
    return this.outcome.observed;
  }

  /** Records the outcome (the first call wins) and reports whether a volume was waiting for it */
  settle(outcome: LogsOutcome): boolean {
    const volumeWaits = this.volumeWaits;
    this.outcome.next(outcome);
    this.outcome.complete();
    return volumeWaits;
  }

  pushLogs(frames: DataFrame[]): void {
    this.barLogs.next(frames);
  }

  failLogs(error: unknown): void {
    this.barLogs.error(error);
  }

  finishVolume(collectedLogs?: DataFrame[]): void {
    this.barLogs.complete();
    this.volumeDone.next(collectedLogs);
    this.volumeDone.complete();
  }
}
