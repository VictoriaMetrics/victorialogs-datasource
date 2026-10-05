import { IncrementalHitsLoadingController, IncrementalHitsLoadingState } from './IncrementalHitsLoadingController';

describe('IncrementalHitsLoadingController', () => {
  const collect = (controller: IncrementalHitsLoadingController) => {
    const states: IncrementalHitsLoadingState[] = [];
    controller.state$.subscribe((s) => states.push(s));
    return states;
  };

  it('starts running with the bar count and counts the loaded bars', () => {
    const controller = new IncrementalHitsLoadingController(3);
    const states = collect(controller);
    controller.barLoaded();
    controller.barLoaded();
    expect(states).toEqual([
      { status: 'running', loadedBars: 0, totalBars: 3 },
      { status: 'running', loadedBars: 1, totalBars: 3 },
      { status: 'running', loadedBars: 2, totalBars: 3 },
    ]);
  });

  it('pauses and resumes', () => {
    const controller = new IncrementalHitsLoadingController(2);
    controller.pause();
    expect(controller.state.status).toBe('paused');
    controller.resume();
    expect(controller.state.status).toBe('running');
  });

  it('opens the gate immediately while running and only after resume while paused', () => {
    const controller = new IncrementalHitsLoadingController(2);
    const passed: number[] = [];
    controller.gate$.subscribe(() => passed.push(1));
    expect(passed).toHaveLength(1);

    controller.pause();
    controller.gate$.subscribe(() => passed.push(2));
    expect(passed).toHaveLength(1);
    controller.resume();
    expect(passed).toEqual([1, 2]);
  });

  it('signals stop to the job without replaying it to a later subscriber', () => {
    const controller = new IncrementalHitsLoadingController(2);
    const stops: number[] = [];
    controller.stopped$.subscribe(() => stops.push(1));
    controller.stop();
    expect(stops).toHaveLength(1);
    const late: number[] = [];
    controller.stopped$.subscribe(() => late.push(1));
    expect(late).toHaveLength(0);
  });
});
