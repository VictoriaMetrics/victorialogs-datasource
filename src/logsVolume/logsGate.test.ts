import { distinctUntilChanged, map, merge, Observable, of, share, takeUntil, throwError, timer } from 'rxjs';
import { RunHelpers, TestScheduler } from 'rxjs/testing';

import { CoreApp, DataQueryRequest, DataQueryResponse, dateTime, LoadingState, makeTimeRange } from '@grafana/data';

import { Query, QueryType, SupportingQueryType } from '../types';

import { IncrementalHitsLoadingController } from './IncrementalHitsLoadingController';
import { slowQueryFrame } from './firstByteTimeout';
import { IncrementalHitsLoadingRuns } from './incrementalHitsLoadingRuns';
import { emptyLogsFrame } from './incrementalLogs';
import { IncrementalHitsLoadingOptions, LogsGate, openLogsGate } from './logsGate';

const makeRequest = (targets: Array<Partial<Query>>, overrides: Partial<DataQueryRequest<Query>> = {}) =>
  ({
    app: CoreApp.Explore,
    requestId: 'explore_a',
    liveStreaming: false,
    timezone: 'utc',
    // 3 s at the default 96 target bars → 1 s step → bars [2000, 3000), [1000, 2000), [0, 1000)
    range: makeTimeRange(dateTime(0), dateTime(3000)),
    targets: targets.map((t) => ({ refId: 'A', expr: '*', queryType: QueryType.Instant, ...t })),
    ...overrides,
  }) as DataQueryRequest<Query>;

const frame = (name: string) => ({ name, fields: [], length: 0 });
const response = (name: string, state?: LoadingState): DataQueryResponse => ({ data: [frame(name)], state });
const streaming = (...names: string[]): DataQueryResponse => ({ data: names.map(frame), state: LoadingState.Streaming });
const done = (...names: string[]): DataQueryResponse => ({ data: names.map(frame), state: LoadingState.Done });
/** The marker the backend returns instead of a result when VictoriaLogs did not start answering within the budget */
const slow: DataQueryResponse = { data: [slowQueryFrame('A')] };
/** Whether a request carries the first byte budget */
const budgeted = (req: DataQueryRequest<Query>) => req.targets.every((t) => t.firstByteTimeoutMs === 5);
/** The leading packet of every gated run: an empty logs frame that clears the previous result in Explore */
const cleared: DataQueryResponse = { data: [emptyLogsFrame('A')], state: LoadingState.Streaming };

type Cold = RunHelpers['cold'];
const barByRange = (cold: Cold) => (req: DataQueryRequest<Query>) =>
  cold<DataQueryResponse>('-(a|)', { a: response(`bar${req.range.from.valueOf() / 1000}`) });

describe('openLogsGate', () => {
  const plain = { runs: new IncrementalHitsLoadingRuns() };
  it('opens a gate for an Explore request of Raw Logs queries, with or without pipes', () => {
    expect(openLogsGate(makeRequest([{ expr: '{app="x"} error' }]), plain)).toBeDefined();
    expect(openLogsGate(makeRequest([{ expr: '* | stats count()' }]), plain)).toBeDefined();
  });

  it('opens none outside Explore or for live streaming', () => {
    expect(openLogsGate(makeRequest([{}], { app: CoreApp.Dashboard }), plain)).toBeUndefined();
    expect(openLogsGate(makeRequest([{}], { app: CoreApp.UnifiedAlerting }), plain)).toBeUndefined();
    expect(openLogsGate(makeRequest([{}], { liveStreaming: true }), plain)).toBeUndefined();
  });

  it('ignores hidden targets, which are not requested', () => {
    expect(openLogsGate(makeRequest([{}, { refId: 'B', hide: true, queryType: QueryType.StatsRange }]), plain)).toBeDefined();
    expect(openLogsGate(makeRequest([{ hide: true }]), plain)).toBeUndefined();
  });

  it('opens none when a visible target is not Raw Logs or is a supporting query', () => {
    expect(openLogsGate(makeRequest([{}, { refId: 'B', queryType: QueryType.StatsRange }]), plain)).toBeUndefined();
    expect(openLogsGate(makeRequest([{ supportingQueryType: SupportingQueryType.InfiniteScroll }]), plain)).toBeUndefined();
  });
});

describe('LogsGate', () => {
  const request = makeRequest([{}]);
  let scheduler: TestScheduler;
  let gate: LogsGate;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    gate = openLogsGate(request, { runs: new IncrementalHitsLoadingRuns() })!;
  });

  it('holds the hits back until the logs answer, and the logs in Streaming until the volume is finished', () => {
    const hits = jest.fn<Observable<DataQueryResponse>, [DataQueryRequest<Query>]>();
    scheduler.run(({ cold, expectObservable }) => {
      const logs = gate.logs(() => cold('---(a|)', { a: response('logs') }));
      hits.mockImplementation(() => cold('--(b|)', { b: response('hits') }));

      expectObservable(gate.volume(request, hits)).toBe('-----(b|)', { b: response('hits') });
      expectObservable(logs).toBe('p--a-(d|)', {
        p: cleared,
        a: response('logs', LoadingState.Streaming),
        d: response('logs', LoadingState.Done),
      });
    });
    expect(hits).toHaveBeenCalledTimes(1);
    expect(hits).toHaveBeenCalledWith(request);
  });

  it('survives the double subscription of Grafana runRequest, which shares the stream and uses it as its own takeUntil notifier', () => {
    const hits = jest.fn<Observable<DataQueryResponse>, [DataQueryRequest<Query>]>();
    scheduler.run(({ cold, expectObservable }) => {
      hits.mockImplementation(() => cold('-(b|)', { b: response('hits') }));
      // runRequest: the notifier subscription is torn down on the first emission; a synchronous
      // first packet would reset the shared source before the data subscription attaches
      const shared = gate.logs(() => cold('--(a|)', { a: response('logs') })).pipe(share());
      const logs = merge(timer(200).pipe(takeUntil(shared)), shared);

      expectObservable(gate.volume(request, hits)).toBe('---(b|)', { b: response('hits') });
      expectObservable(logs).toBe('p-a(d|)', {
        p: cleared,
        a: response('logs', LoadingState.Streaming),
        d: response('logs', LoadingState.Done),
      });
    });
    expect(hits).toHaveBeenCalledTimes(1);
  });

  it('clears the previous result at once and passes the logs through unchanged when no volume is waiting', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(gate.logs(() => cold('---(a|)', { a: response('logs') }))).toBe('p--(a|)', { p: cleared, a: response('logs') });
    });
  });

  it('skips the hits and completes the volume empty when the logs stream fails', () => {
    const hits = jest.fn(() => of(response('hits')));
    const volume: DataQueryResponse[] = [];
    let failure: unknown;
    scheduler.run(({ flush }) => {
      gate.volume(request, hits).subscribe((v) => volume.push(v));
      gate.logs(() => throwError(() => new Error('boom'))).subscribe({ error: (e) => (failure = e) });
      flush();
    });

    expect(failure).toEqual(new Error('boom'));
    expect(hits).not.toHaveBeenCalled();
    expect(volume).toEqual([{ data: [], state: LoadingState.Done }]);
  });

  it('treats an in-band query error as failed logs and passes the response through', () => {
    const hits = jest.fn(() => of(response('hits')));
    const volume: DataQueryResponse[] = [];
    gate.volume(request, hits).subscribe((v) => volume.push(v));

    const failed: DataQueryResponse = { data: [], errors: [{ message: 'bad query' }] };
    const logs: DataQueryResponse[] = [];
    scheduler.run(({ flush }) => {
      gate.logs(() => of(failed)).subscribe((r) => logs.push(r));
      flush();
    });

    expect(logs).toEqual([cleared, failed]);
    expect(hits).not.toHaveBeenCalled();
    expect(volume).toEqual([{ data: [], state: LoadingState.Done }]);
  });

  it('skips the hits when the logs are cancelled before they answer', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const hits = jest.fn(() => cold('-(b|)', { b: response('hits') }));
      expectObservable(gate.logs(() => cold<DataQueryResponse>('----------(a|)')), '^--!').toBe('p', { p: cleared });
      expectObservable(gate.volume(request, hits)).toBe('---(e|)', { e: { data: [], state: LoadingState.Done } });
    });
  });

  it('replays the outcome to a volume that subscribes after the logs are done', () => {
    const logs: DataQueryResponse[] = [];
    scheduler.run(({ flush }) => {
      gate.logs(() => of(response('logs'))).subscribe((r) => logs.push(r));
      flush();
    });
    expect(logs).toEqual([cleared, response('logs')]);

    const seen: DataQueryResponse[] = [];
    gate.volume(request, (): Observable<DataQueryResponse> => of(response('hits'))).subscribe((v) => seen.push(v));
    expect(seen).toEqual([response('hits')]);
  });
});

describe('LogsGate with incremental hits loading', () => {
  const request = makeRequest([{}]);
  let scheduler: TestScheduler;
  let runs: IncrementalHitsLoadingRuns;
  let incremental: IncrementalHitsLoadingOptions;
  /** The controller of the pane's running job, as the status row would find it */
  const controller = (): IncrementalHitsLoadingController => {
    let seen: IncrementalHitsLoadingController | undefined;
    runs.job$(request.requestId).subscribe((job) => (seen = job?.controller)).unsubscribe();
    if (!seen) {
      throw new Error('no running job');
    }
    return seen;
  };
  let gate: LogsGate;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    runs = new IncrementalHitsLoadingRuns();
    incremental = { timeoutMs: 5, runs };
    gate = openLogsGate(request, incremental)!;
  });

  it('after fast logs tries the hits in one shot under the budget and keeps the logs in Streaming until the volume is done', () => {
    const hits = jest.fn((_req: DataQueryRequest<Query>) => scheduler.createColdObservable('--(b|)', { b: response('hits') }));
    const run = jest.fn((_req: DataQueryRequest<Query>) => scheduler.createColdObservable('---(a|)', { a: response('logs') }));
    scheduler.run(({ expectObservable }) => {
      expectObservable(gate.volume(request, hits)).toBe('-----(b|)', { b: response('hits') });
      expectObservable(gate.logs(run)).toBe('p--a-(d|)', {
        p: cleared,
        a: response('logs', LoadingState.Streaming),
        d: response('logs', LoadingState.Done),
      });
    });
    // a volume was waiting when the logs were sent, so both one-shot requests carried the budget
    expect(run.mock.calls.map(([req]) => budgeted(req))).toEqual([true]);
    expect(hits.mock.calls.map(([req]) => budgeted(req))).toEqual([true]);
  });

  it('after fast logs switches to bar-by-bar loading when the backend gives the one-shot hits up', () => {
    const hits = jest.fn<Observable<DataQueryResponse>, [DataQueryRequest<Query>]>();
    scheduler.run(({ cold, expectObservable }) => {
      hits.mockImplementation((req) => (budgeted(req) ? cold('---(m|)', { m: slow }) : barByRange(cold)(req)));
      const logs = gate.logs(() => cold('-(a|)', { a: response('logs') }));

      // logs at 1, the one-shot hits give up at 4, bars at 5, 6, 7
      expectObservable(gate.volume(request, hits)).toBe('-----ab(cd|)', {
        a: streaming('bar2'),
        b: streaming('bar2', 'bar1'),
        c: streaming('bar2', 'bar1', 'bar0'),
        d: done('bar2', 'bar1', 'bar0'),
      });
      expectObservable(logs).toBe('pa-----(d|)', {
        p: cleared,
        a: response('logs', LoadingState.Streaming),
        d: response('logs', LoadingState.Done),
      });
    });
    // the one-shot carried the budget, the bars did not
    expect(hits.mock.calls.map(([req]) => budgeted(req))).toEqual([true, false, false, false]);
  });

  it('hands slow logs over to the volume while it waits: bars right away, the logs requested again without the budget afterwards', () => {
    const run = jest.fn<Observable<DataQueryResponse>, [DataQueryRequest<Query>]>();
    scheduler.run(({ cold, expectObservable }) => {
      run.mockImplementation((req) => (budgeted(req) ? cold('---(m|)', { m: slow }) : cold('--(a|)', { a: response('rerun') })));
      const hits = jest.fn(barByRange(cold));

      // the backend gives the logs up at 3: bars at 4, 5, 6; the logs are requested again at 6 and answer at 8
      expectObservable(gate.volume(request, hits)).toBe('----ab(cd|)', {
        a: streaming('bar2'),
        b: streaming('bar2', 'bar1'),
        c: streaming('bar2', 'bar1', 'bar0'),
        d: done('bar2', 'bar1', 'bar0'),
      });
      // the leading empty packet keeps the Explore logs section (and the volume above it) on screen while waiting
      expectObservable(gate.logs(run)).toBe('p-------(a|)', { p: cleared, a: response('rerun') });
      expect(hits.mock.calls.some(([req]) => req.range === request.range)).toBe(false);
    });
    expect(run.mock.calls.map(([req]) => budgeted(req))).toEqual([true, false]);
  });

  it('fails the volume on the first bar with an in-band error, releases the job and the held logs', () => {
    const boom = { message: 'boom' };
    const run = jest.fn<Observable<DataQueryResponse>, [DataQueryRequest<Query>]>();
    const hits = jest.fn<Observable<DataQueryResponse>, [DataQueryRequest<Query>]>();
    scheduler.run(({ cold, expectObservable }) => {
      run.mockImplementation((req) => (budgeted(req) ? cold('---(m|)', { m: slow }) : cold('--(a|)', { a: response('rerun') })));
      // the second bar answers with an error instead of a result
      hits.mockImplementation((req) => (req.range.from.valueOf() === 1000 ? cold('-(e|)', { e: { data: [], errors: [boom] } }) : barByRange(cold)(req)));

      // the logs are given up at 3 and the job starts: the first bar at 4, the failed one at 5 ends the volume and the job; the logs are requested again at 5
      expectObservable(gate.volume(request, hits)).toBe('----a#', { a: streaming('bar2') }, boom);
      expectObservable(gate.logs(run)).toBe('p------(a|)', { p: cleared, a: response('rerun') });
      expectObservable(runs.job$('explore_a').pipe(map((job) => (job ? 'job' : 'none')), distinctUntilChanged())).toBe('n--j-n', { n: 'none', j: 'job' });
    });
    // the third bar is never requested
    expect(hits).toHaveBeenCalledTimes(2);
  });

  it('registers the bar-by-bar job under the request of the pane while it runs', () => {
    scheduler.run(({ cold, expectObservable }) => {
      gate.logs(() => cold('-(a|)', { a: response('logs') })).subscribe();
      const hits = (req: DataQueryRequest<Query>) => (budgeted(req) ? cold('---(m|)', { m: slow }) : barByRange(cold)(req));
      gate.volume(request, hits).subscribe();

      // nothing before the bars start at 4; a job from 4 to 7; released with the last bar
      expectObservable(runs.job$('explore_a').pipe(map((job) => (job ? 'job' : 'none')), distinctUntilChanged())).toBe('n---j--(n)', { n: 'none', j: 'job' });
      expectObservable(runs.job$('explore_other').pipe(map((job) => (job ? 'job' : 'none')))).toBe('n', { n: 'none' });
    });
  });

  it('keeps the re-requested logs waiting while the bars are paused', () => {
    scheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
      const rerun = cold<DataQueryResponse>('(a|)', { a: response('rerun') });
      const run = (req: DataQueryRequest<Query>) => (budgeted(req) ? cold('---(m|)', { m: slow }) : rerun);
      // pause right after the first bar (frame 4), resume at 8: bars at 4, 9, 10
      cold('----x---y').subscribe((v) => (v === 'x' ? controller().pause() : controller().resume()));

      expectObservable(gate.volume(request, barByRange(cold))).toBe('----a----b(cd|)', {
        a: streaming('bar2'),
        b: streaming('bar2', 'bar1'),
        c: streaming('bar2', 'bar1', 'bar0'),
        d: done('bar2', 'bar1', 'bar0'),
      });
      expectObservable(gate.logs(run)).toBe('p---------(a|)', { p: cleared, a: response('rerun') });
      expectSubscriptions(rerun.subscriptions).toBe('----------(^!)');
    });
  });

  it('loads the logs once the user stops the bars, keeping the bars loaded so far', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const run = (req: DataQueryRequest<Query>) => (budgeted(req) ? cold('---(m|)', { m: slow }) : cold('(a|)', { a: response('rerun') }));
      cold('-----x').subscribe(() => controller().stop());

      expectObservable(gate.volume(request, barByRange(cold))).toBe('----a(d|)', {
        a: streaming('bar2'),
        d: done('bar2'),
      });
      expectObservable(gate.logs(run)).toBe('p----(a|)', { p: cleared, a: response('rerun') });
    });
  });

  it('sends the logs without the budget when no volume is waiting, and a later volume waits for them', () => {
    const run = jest.fn((_req: DataQueryRequest<Query>) => scheduler.createColdObservable('----------(a|)', { a: response('slow') }));
    const hits = jest.fn((_req: DataQueryRequest<Query>) => scheduler.createColdObservable('--(b|)', { b: response('hits') }));
    scheduler.run(({ cold, expectObservable }) => {
      // the volume panel is switched on at 7, after the logs were sent
      cold('-------x').subscribe(() => expectObservable(gate.volume(request, hits)).toBe('------------(b|)', { b: response('hits') }));
      expectObservable(gate.logs(run)).toBe('p---------a-(d|)', {
        p: cleared,
        a: response('slow', LoadingState.Streaming),
        d: response('slow', LoadingState.Done),
      });
    });
    expect(run.mock.calls.map(([req]) => budgeted(req))).toEqual([false]);
    expect(hits.mock.calls.map(([req]) => budgeted(req))).toEqual([true]);
  });

  it('skips the volume when the logs fail', () => {
    const hits = jest.fn(() => of(response('hits')));
    const volume: DataQueryResponse[] = [];
    scheduler.run(({ flush }) => {
      gate.volume(request, hits).subscribe((v) => volume.push(v));
      gate.logs(() => throwError(() => new Error('boom'))).subscribe({ error: () => undefined });
      flush();
    });
    expect(hits).not.toHaveBeenCalled();
    expect(volume).toEqual([{ data: [], state: LoadingState.Done }]);
  });

  it('skips the volume when the logs are cancelled before they answer', () => {
    const hits = jest.fn<Observable<DataQueryResponse>, [DataQueryRequest<Query>]>();
    scheduler.run(({ cold, expectObservable }) => {
      hits.mockImplementation(barByRange(cold));
      expectObservable(gate.logs(() => cold<DataQueryResponse>('----------(a|)')), '^--!').toBe('p', { p: cleared });
      expectObservable(gate.volume(request, hits)).toBe('---(e|)', { e: { data: [], state: LoadingState.Done } });
    });
    // checked after the run: inside it the subscriptions have not been scheduled yet
    expect(hits).not.toHaveBeenCalled();
  });

  it('is plain (no budget, no bars) when a visible target has the option switched off', () => {
    const plain = openLogsGate(makeRequest([{}, { refId: 'B', incrementalHitsLoading: false }]), incremental)!;
    const hits = jest.fn((_req: DataQueryRequest<Query>) => scheduler.createColdObservable('----------(b|)', { b: response('hits') }));
    const run = jest.fn((_req: DataQueryRequest<Query>) => scheduler.createColdObservable('----------(a|)', { a: response('logs') }));
    scheduler.run(({ expectObservable }) => {
      expectObservable(plain.volume(request, hits)).toBe('--------------------(b|)', { b: response('hits') });
      expectObservable(plain.logs(run)).toBe('p---------a---------(d|)', {
        // one empty frame per visible target
        p: { data: [emptyLogsFrame('A'), emptyLogsFrame('B')], state: LoadingState.Streaming },
        a: response('logs', LoadingState.Streaming),
        d: response('logs', LoadingState.Done),
      });
    });
    expect(hits).toHaveBeenCalledWith(request);
    expect(run.mock.calls.map(([req]) => req.targets.some((t) => t.firstByteTimeoutMs !== undefined))).toEqual([false]);
  });
});
