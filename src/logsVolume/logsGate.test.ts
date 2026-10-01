import { Observable, of, throwError } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';

import { CoreApp, DataQueryRequest, DataQueryResponse, LoadingState } from '@grafana/data';

import { Query, QueryType, SupportingQueryType } from '../types';

import { LogsGate, openLogsGate } from './logsGate';

const makeRequest = (targets: Array<Partial<Query>>, overrides: Partial<DataQueryRequest<Query>> = {}) =>
  ({
    app: CoreApp.Explore,
    liveStreaming: false,
    targets: targets.map((t) => ({ refId: 'A', expr: '*', queryType: QueryType.Instant, ...t })),
    ...overrides,
  }) as DataQueryRequest<Query>;

const response = (name: string, state?: LoadingState): DataQueryResponse => ({ data: [{ name, fields: [], length: 0 }], state });

describe('openLogsGate', () => {
  it('opens a gate for an Explore request of Raw Logs queries, with or without pipes', () => {
    expect(openLogsGate(makeRequest([{ expr: '{app="x"} error' }]))).toBeDefined();
    expect(openLogsGate(makeRequest([{ expr: '* | stats count()' }]))).toBeDefined();
  });

  it('opens none outside Explore or for live streaming', () => {
    expect(openLogsGate(makeRequest([{}], { app: CoreApp.Dashboard }))).toBeUndefined();
    expect(openLogsGate(makeRequest([{}], { app: CoreApp.UnifiedAlerting }))).toBeUndefined();
    expect(openLogsGate(makeRequest([{}], { liveStreaming: true }))).toBeUndefined();
  });

  it('ignores hidden targets, which are not requested', () => {
    expect(openLogsGate(makeRequest([{}, { refId: 'B', hide: true, queryType: QueryType.StatsRange }]))).toBeDefined();
    expect(openLogsGate(makeRequest([{ hide: true }]))).toBeUndefined();
  });

  it('opens none when a visible target is not Raw Logs or is a supporting query', () => {
    expect(openLogsGate(makeRequest([{}, { refId: 'B', queryType: QueryType.StatsRange }]))).toBeUndefined();
    expect(openLogsGate(makeRequest([{ supportingQueryType: SupportingQueryType.InfiniteScroll }]))).toBeUndefined();
  });
});

describe('LogsGate', () => {
  let scheduler: TestScheduler;
  let gate: LogsGate;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    gate = openLogsGate(makeRequest([{}]))!;
  });

  it('holds the hits back until the logs answer, and the logs in Streaming until the volume is finished', () => {
    const hits = jest.fn<Observable<DataQueryResponse>, []>();
    scheduler.run(({ cold, expectObservable }) => {
      const logs = cold('---(a|)', { a: response('logs') }).pipe(gate.logs());
      hits.mockImplementation(() => cold('--(b|)', { b: response('hits') }));

      expectObservable(gate.volume(hits)).toBe('-----(b|)', { b: response('hits') });
      expectObservable(logs).toBe('---a-(d|)', {
        a: response('logs', LoadingState.Streaming),
        d: response('logs', LoadingState.Done),
      });
    });
    expect(hits).toHaveBeenCalledTimes(1);
  });

  it('passes the logs through unchanged when no volume is waiting', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(cold('---(a|)', { a: response('logs') }).pipe(gate.logs())).toBe('---(a|)', { a: response('logs') });
    });
  });

  it('skips the hits and completes the volume empty when the logs stream fails', () => {
    const hits = jest.fn(() => of(response('hits')));
    const volume: DataQueryResponse[] = [];
    gate.volume(hits).subscribe((v) => volume.push(v));

    let failure: unknown;
    throwError(() => new Error('boom'))
      .pipe(gate.logs())
      .subscribe({ error: (e) => (failure = e) });

    expect(failure).toEqual(new Error('boom'));
    expect(hits).not.toHaveBeenCalled();
    expect(volume).toEqual([{ data: [], state: LoadingState.Done }]);
  });

  it('treats an in-band query error as failed logs and passes the response through', () => {
    const hits = jest.fn(() => of(response('hits')));
    const volume: DataQueryResponse[] = [];
    gate.volume(hits).subscribe((v) => volume.push(v));

    const failed: DataQueryResponse = { data: [], errors: [{ message: 'bad query' }] };
    const logs: DataQueryResponse[] = [];
    of(failed).pipe(gate.logs()).subscribe((r) => logs.push(r));

    expect(logs).toEqual([failed]);
    expect(hits).not.toHaveBeenCalled();
    expect(volume).toEqual([{ data: [], state: LoadingState.Done }]);
  });

  it('skips the hits when the logs are cancelled before they answer', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const hits = jest.fn(() => cold('-(b|)', { b: response('hits') }));
      expectObservable(cold<DataQueryResponse>('----------(a|)').pipe(gate.logs()), '^--!').toBe('');
      expectObservable(gate.volume(hits)).toBe('---(e|)', { e: { data: [], state: LoadingState.Done } });
    });
  });

  it('replays the outcome to a volume that subscribes after the logs are done', () => {
    const logs: DataQueryResponse[] = [];
    of(response('logs')).pipe(gate.logs()).subscribe((r) => logs.push(r));
    expect(logs).toEqual([response('logs')]);

    const seen: DataQueryResponse[] = [];
    gate.volume((): Observable<DataQueryResponse> => of(response('hits'))).subscribe((v) => seen.push(v));
    expect(seen).toEqual([response('hits')]);
  });
});
