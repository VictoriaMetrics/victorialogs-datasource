import { BehaviorSubject, filter, Observable, Subject, take } from 'rxjs';

/** The log lines collected for one query out of its line limit */
export interface LogsProgress {
  refId: string;
  loaded: number;
  limit: number;
}

export interface IncrementalHitsLoadingState {
  status: 'running' | 'paused';
  loadedBars: number;
  totalBars: number;
  /** Bucket step of the bars, e.g. `2d` */
  step: string;
  /** Empty until a job that loads the logs with its bars has collected the first ones */
  logs: LogsProgress[];
}

/** What the job knows about its bars before it starts */
export interface IncrementalHitsLoadingBars {
  totalBars: number;
  step: string;
}

/**
 * Progress and controls of one bar-by-bar logs volume job: the job reports every bar and
 * waits at the gate between bars, the query editor shows the progress and lets the user
 * pause, resume or stop the job (stop keeps the bars loaded so far). Lives as long as the
 * job; see `IncrementalHitsLoadingRuns` for how a pane finds the controller of its job
 */
export class IncrementalHitsLoadingController {
  private readonly stateSubject: BehaviorSubject<IncrementalHitsLoadingState>;
  private readonly stopSubject = new Subject<void>();

  readonly state$: Observable<IncrementalHitsLoadingState>;
  /** Fires when the user stops the job */
  readonly stopped$: Observable<void> = this.stopSubject.asObservable();
  /** Emits once as soon as the job is not paused; subscribe before every bar request */
  readonly gate$: Observable<IncrementalHitsLoadingState>;

  constructor({ totalBars, step }: IncrementalHitsLoadingBars) {
    this.stateSubject = new BehaviorSubject<IncrementalHitsLoadingState>({ status: 'running', loadedBars: 0, totalBars, step, logs: [] });
    this.state$ = this.stateSubject.asObservable();
    this.gate$ = this.state$.pipe(
      filter((state) => state.status !== 'paused'),
      take(1)
    );
  }

  get state(): IncrementalHitsLoadingState {
    return this.stateSubject.value;
  }

  barLoaded(): void {
    this.stateSubject.next({ ...this.state, loadedBars: this.state.loadedBars + 1 });
  }

  logsLoaded(logs: LogsProgress[]): void {
    this.stateSubject.next({ ...this.state, logs });
  }

  pause(): void {
    this.stateSubject.next({ ...this.state, status: 'paused' });
  }

  resume(): void {
    this.stateSubject.next({ ...this.state, status: 'running' });
  }

  stop(): void {
    this.stopSubject.next();
  }
}
