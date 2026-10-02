import { getIncrementalHitsLoadingController, IncrementalHitsLoadingController, IncrementalHitsLoadingState } from './IncrementalHitsLoadingController';

describe('IncrementalHitsLoadingController', () => {
  const collect = (controller: IncrementalHitsLoadingController) => {
    const states: IncrementalHitsLoadingState[] = [];
    controller.state$.subscribe((s) => states.push(s));
    return states;
  };

  it('starts idle', () => {
    expect(new IncrementalHitsLoadingController().state).toEqual({ status: 'idle', loadedBars: 0, totalBars: 0 });
  });

  it('tracks a running job bar by bar and goes back to idle when finished', () => {
    const controller = new IncrementalHitsLoadingController();
    const states = collect(controller);
    controller.start(3);
    controller.barLoaded();
    controller.barLoaded();
    controller.finish();
    expect(states).toEqual([
      { status: 'idle', loadedBars: 0, totalBars: 0 },
      { status: 'running', loadedBars: 0, totalBars: 3 },
      { status: 'running', loadedBars: 1, totalBars: 3 },
      { status: 'running', loadedBars: 2, totalBars: 3 },
      { status: 'idle', loadedBars: 0, totalBars: 0 },
    ]);
  });

  it('pauses and resumes a running job, ignoring pause when nothing runs', () => {
    const controller = new IncrementalHitsLoadingController();
    controller.pause();
    expect(controller.state.status).toBe('idle');
    controller.start(2);
    controller.pause();
    expect(controller.state.status).toBe('paused');
    controller.resume();
    expect(controller.state.status).toBe('running');
  });

  it('opens the gate immediately while running and only after resume while paused', () => {
    const controller = new IncrementalHitsLoadingController();
    controller.start(2);
    const passed: number[] = [];
    controller.gate$.subscribe(() => passed.push(1));
    expect(passed).toHaveLength(1);

    controller.pause();
    controller.gate$.subscribe(() => passed.push(2));
    expect(passed).toHaveLength(1);
    controller.resume();
    expect(passed).toEqual([1, 2]);
  });

  it('signals stop once and leaves the reset to the job that finishes', () => {
    const controller = new IncrementalHitsLoadingController();
    controller.start(2);
    const stops: number[] = [];
    controller.stopped$.subscribe(() => stops.push(1));
    controller.stop();
    expect(stops).toHaveLength(1);
    expect(controller.state.status).toBe('running');
    controller.finish();
    expect(controller.state.status).toBe('idle');
  });

  it('does not replay an old stop to a job started later', () => {
    const controller = new IncrementalHitsLoadingController();
    controller.start(1);
    controller.stop();
    controller.start(1);
    const stops: number[] = [];
    controller.stopped$.subscribe(() => stops.push(1));
    expect(stops).toHaveLength(0);
  });
});

describe('getIncrementalHitsLoadingController', () => {
  it('returns one controller per datasource uid, so every instance of the datasource shares the job state', () => {
    const controller = getIncrementalHitsLoadingController('ds-a');
    expect(controller).toBeInstanceOf(IncrementalHitsLoadingController);
    expect(getIncrementalHitsLoadingController('ds-a')).toBe(controller);
    expect(getIncrementalHitsLoadingController('ds-b')).not.toBe(controller);
  });
});
