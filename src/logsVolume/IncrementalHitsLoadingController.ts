import { BehaviorSubject, filter, Observable, Subject, take } from 'rxjs';

export type IncrementalHitsLoadingStatus = 'idle' | 'running' | 'paused';

export interface IncrementalHitsLoadingState {
  status: IncrementalHitsLoadingStatus;
  loadedBars: number;
  totalBars: number;
}

const IDLE: IncrementalHitsLoadingState = { status: 'idle', loadedBars: 0, totalBars: 0 };

/**
 * Shared state of the bar-by-bar logs volume loading: the job reports its progress and
 * waits at the gate between bars, the query editor shows the progress and lets the user
 * pause, resume or stop the job (stop keeps the bars loaded so far)
 */
export class IncrementalHitsLoadingController {
  private readonly stateSubject = new BehaviorSubject<IncrementalHitsLoadingState>(IDLE);
  private readonly stopSubject = new Subject<void>();

  readonly state$: Observable<IncrementalHitsLoadingState> = this.stateSubject.asObservable();
  /** Fires when the user stops the running job; the job resets the state once it has finished */
  readonly stopped$: Observable<void> = this.stopSubject.asObservable();
  /** Emits once as soon as the job is not paused; subscribe before every bar request */
  readonly gate$: Observable<IncrementalHitsLoadingState> = this.state$.pipe(
    filter((state) => state.status !== 'paused'),
    take(1)
  );

  get state(): IncrementalHitsLoadingState {
    return this.stateSubject.value;
  }

  start(totalBars: number): void {
    this.stateSubject.next({ status: 'running', loadedBars: 0, totalBars });
  }

  barLoaded(): void {
    this.stateSubject.next({ ...this.state, loadedBars: this.state.loadedBars + 1 });
  }

  finish(): void {
    this.stateSubject.next(IDLE);
  }

  pause(): void {
    if (this.state.status === 'running') {
      this.stateSubject.next({ ...this.state, status: 'paused' });
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.stateSubject.next({ ...this.state, status: 'running' });
    }
  }

  stop(): void {
    this.stopSubject.next();
  }
}

const controllers = new Map<string, IncrementalHitsLoadingController>();

/**
 * The controller shared by every instance of the datasource with the given uid. Grafana
 * may instantiate the same datasource more than once (an Explore pane and its query editor
 * loading it concurrently by uid and by name), and the status row has to see the job of
 * the instance that runs the queries
 */
export function getIncrementalHitsLoadingController(datasourceUid: string): IncrementalHitsLoadingController {
  let controller = controllers.get(datasourceUid);
  if (!controller) {
    controller = new IncrementalHitsLoadingController();
    controllers.set(datasourceUid, controller);
  }
  return controller;
}
