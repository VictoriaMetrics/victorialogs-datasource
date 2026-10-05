import { IncrementalHitsLoadingController } from './IncrementalHitsLoadingController';
import { getIncrementalHitsLoadingRuns, IncrementalHitsLoadingJob, IncrementalHitsLoadingRuns } from './incrementalHitsLoadingRuns';

describe('IncrementalHitsLoadingRuns', () => {
  const currentJob = (runs: IncrementalHitsLoadingRuns, requestId: string | undefined) => {
    let seen: IncrementalHitsLoadingJob | undefined;
    runs.job$(requestId).subscribe((job) => (seen = job)).unsubscribe();
    return seen;
  };

  it('has no job for a pane that has not run or has not run yet at all', () => {
    const runs = new IncrementalHitsLoadingRuns();
    expect(currentJob(runs, 'explore_a')).toBeUndefined();
    expect(currentJob(runs, undefined)).toBeUndefined();
  });

  it('hands a pane its own job only and releases it when the job is over', () => {
    const runs = new IncrementalHitsLoadingRuns();
    const left = new IncrementalHitsLoadingController(3);
    const right = new IncrementalHitsLoadingController(5);
    const releaseLeft = runs.register('explore_a', left);
    runs.register('explore_b', right);
    expect(currentJob(runs, 'explore_a')?.controller).toBe(left);
    expect(currentJob(runs, 'explore_b')?.controller).toBe(right);

    releaseLeft();
    expect(currentJob(runs, 'explore_a')).toBeUndefined();
    expect(currentJob(runs, 'explore_b')?.controller).toBe(right);
  });

  it('finds the job of a mixed datasource sub-request by the pane behind its prefixed request id', () => {
    const runs = new IncrementalHitsLoadingRuns();
    const job = new IncrementalHitsLoadingController(1);
    runs.register('mixed-0-explore_a', job);
    expect(currentJob(runs, 'explore_a')?.controller).toBe(job);
    expect(currentJob(runs, 'explore_b')).toBeUndefined();
  });

  it('replaces the job of a pane that runs again and ignores the stale release', () => {
    const runs = new IncrementalHitsLoadingRuns();
    const old = new IncrementalHitsLoadingController(1);
    const fresh = new IncrementalHitsLoadingController(1);
    const releaseOld = runs.register('explore_a', old);
    runs.register('explore_a', fresh);
    releaseOld();
    expect(currentJob(runs, 'explore_a')?.controller).toBe(fresh);
  });

  it('streams the live state of the job of the pane, from registration to release', () => {
    const runs = new IncrementalHitsLoadingRuns();
    const seen: Array<string | undefined> = [];
    runs.job$('explore_a').subscribe((job) => seen.push(job && `${job.state.status}:${job.state.loadedBars}/${job.state.totalBars}`));
    const controller = new IncrementalHitsLoadingController(2);
    const release = runs.register('explore_a', controller);
    controller.barLoaded();
    controller.pause();
    release();
    expect(seen).toEqual([undefined, 'running:0/2', 'running:1/2', 'paused:1/2', undefined]);
  });
});

describe('getIncrementalHitsLoadingRuns', () => {
  it('returns one registry per datasource uid, so every instance of the datasource shares it', () => {
    const runs = getIncrementalHitsLoadingRuns('ds-a');
    expect(runs).toBeInstanceOf(IncrementalHitsLoadingRuns);
    expect(getIncrementalHitsLoadingRuns('ds-a')).toBe(runs);
    expect(getIncrementalHitsLoadingRuns('ds-b')).not.toBe(runs);
  });
});
