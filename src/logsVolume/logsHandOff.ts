import { AsyncSubject, Observable } from 'rxjs';

/** How the raw logs ended: in time, past the budget, or with an error or a cancellation */
export type LogsOutcome = 'fast' | 'slow' | 'failed';

/**
 * The two signals between the logs and the volume streams of one Explore run. Both fire
 * once and replay, so either side may subscribe before or after the other has settled
 */
export class LogsHandOff {
  private readonly outcome = new AsyncSubject<LogsOutcome>();
  private readonly volumeDone = new AsyncSubject<void>();

  readonly outcome$: Observable<LogsOutcome> = this.outcome.asObservable();
  readonly volumeDone$: Observable<void> = this.volumeDone.asObservable();

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

  finishVolume(): void {
    this.volumeDone.next();
    this.volumeDone.complete();
  }
}
