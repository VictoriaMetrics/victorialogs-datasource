import { of, throwError } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';

import { DataFrame, DataQueryRequest, DataQueryResponse, dateTime, FieldColorModeId, FieldType, LoadingState, LogLevel, toDataFrame } from '@grafana/data';

import { LOG_LEVEL_COLOR } from './configuration/LogLevelRules/const';
import { LogLevelRuleType } from './configuration/LogLevelRules/types';
import { aggregateRawLogsVolume, aggregateVolumeFrames, extractLevel, getUniformVolumeTimeAxis, queryLogsVolume } from './logsVolumeLegacy';
import { Query } from './types';
import { DERIVED_LEVEL_FIELD } from './utils/query/levelFormatPipes';

const makeFrame = (labels?: Record<string, string>, refId?: string) =>
  toDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      { name: 'Value', type: FieldType.number, values: [1], labels },
    ],
  });

describe('extractLevel', () => {
  it('maps the derived level label directly', () => {
    expect(extractLevel(makeFrame({ [DERIVED_LEVEL_FIELD]: 'error' }), [])).toBe(LogLevel.error);
  });

  it('maps an empty derived level to unknown without applying rules', () => {
    const rules = [
      { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'error', level: LogLevel.error, enabled: true },
    ];
    expect(extractLevel(makeFrame({ [DERIVED_LEVEL_FIELD]: '' }), rules)).toBe(LogLevel.unknown);
  });

  it('falls back to label matching when the derived label is absent', () => {
    expect(extractLevel(makeFrame({ level: 'error' }), [])).toBe(LogLevel.error);
  });

  it('returns unknown when the value field has no labels', () => {
    expect(extractLevel(makeFrame(), [])).toBe(LogLevel.unknown);
  });
});

describe('aggregateRawLogsVolume level styling', () => {
  const times = [0];

  const valueConfig = (frames: ReturnType<typeof aggregateRawLogsVolume>) =>
    frames[0].fields.find((f) => f.name === 'Value')?.config;

  it('canonicalizes an alias level label — `warn` colors the series as warning, not unknown', () => {
    // extractLevelFromLabels passes the raw label value through, so the alias reaches the styling
    const frames = aggregateRawLogsVolume([makeFrame({ level: 'warn' })], extractLevel, times, []);
    expect(frames).toHaveLength(1);
    expect(valueConfig(frames)?.displayNameFromDS).toBe(LogLevel.warning);
    expect(valueConfig(frames)?.color?.fixedColor).toBe(LOG_LEVEL_COLOR[LogLevel.warning]);
  });

  it('renders an unspecified ("") level as unknown', () => {
    const frames = aggregateRawLogsVolume([makeFrame()], () => LogLevel.unspecified, times, []);
    expect(valueConfig(frames)?.displayNameFromDS).toBe(LogLevel.unknown);
    expect(valueConfig(frames)?.color?.fixedColor).toBe(LOG_LEVEL_COLOR[LogLevel.unknown]);
  });
});

describe('aggregateVolumeFrames custom grouping', () => {
  const request = {
    timezone: 'UTC',
    range: {
      from: dateTime('2026-07-06T00:00:00Z'),
      to: dateTime('2026-07-06T01:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    },
  } as DataQueryRequest<Query>;

  const makeTarget = (overrides: Partial<Query>): Query => ({
    refId: 'log-volume-A',
    expr: '*',
    ...overrides,
  });

  const configOf = (frame: ReturnType<typeof aggregateVolumeFrames>[number]) =>
    frame.fields.find((f) => f.name === 'Value')?.config;

  it('renders one palette-colored series per group value', () => {
    const targets = [makeTarget({ groupBy: 'container_name' })];
    const frames = aggregateVolumeFrames(
      [
        makeFrame({ container_name: 'app-1' }, 'log-volume-A'),
        makeFrame({ container_name: 'app-2' }, 'log-volume-A'),
      ],
      targets,
      request,
      []
    );

    expect(frames).toHaveLength(2);
    expect(frames.map((f) => configOf(f)?.displayNameFromDS)).toEqual(['app-1', 'app-2']);
    expect(configOf(frames[0])?.color?.mode).toBe(FieldColorModeId.PaletteClassic);
  });

  it('labels an empty group value as (empty) and the merged tail bucket as other', () => {
    const targets = [makeTarget({ groupBy: 'container_name' })];
    const frames = aggregateVolumeFrames(
      [
        makeFrame({ container_name: '' }, 'log-volume-A'),
        // the fields_limit tail bucket comes back without the group field at all
        makeFrame({}, 'log-volume-A'),
      ],
      targets,
      request,
      []
    );

    expect(frames.map((f) => configOf(f)?.displayNameFromDS)).toEqual(['(empty)', 'other']);
  });

  it('keeps the level aggregation for targets without a custom groupBy', () => {
    const targets = [makeTarget({ groupBy: 'level' })];
    const frames = aggregateVolumeFrames([makeFrame({ level: 'error' }, 'log-volume-A')], targets, request, []);

    expect(frames).toHaveLength(1);
    expect(configOf(frames[0])?.displayNameFromDS).toBe(LogLevel.error);
    expect(configOf(frames[0])?.color?.fixedColor).toBe(LOG_LEVEL_COLOR[LogLevel.error]);
  });
});

describe('aggregateRawLogsVolume re-bucketing', () => {
  const from = dateTime('2026-07-06T00:00:00Z');
  const range = { from, to: dateTime('2026-07-06T01:00:00Z'), raw: { from: 'now-1h', to: 'now' } };
  // 4 bars over one hour give a 15-minute display grid
  const times = getUniformVolumeTimeAxis(range, 4);
  const stepMs = 15 * 60 * 1000;
  const start = from.valueOf();

  const makeTimedFrame = (times: number[], values: number[]) =>
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: times },
        { name: 'Value', type: FieldType.number, values, labels: { level: 'info' } },
      ],
    });

  const valuesOf = (frames: ReturnType<typeof aggregateRawLogsVolume>) =>
    frames[0].fields.find((f) => f.name === 'Value')?.values;

  it('lays the output on a grid of `bars` cells starting at range.from', () => {
    const frames = aggregateRawLogsVolume([makeTimedFrame([start], [1])], extractLevel, times, []);
    expect(frames[0].fields.find((f) => f.name === 'Time')?.values).toEqual(
      [0, 1, 2, 3].map((i) => start + i * stepMs)
    );
  });

  it('sums every source bucket into the grid cell it falls into, across frames', () => {
    const frames = aggregateRawLogsVolume(
      [makeTimedFrame([start + stepMs, start + stepMs + 60_000], [2, 3]), makeTimedFrame([start + 2 * stepMs], [4])],
      extractLevel,
      times,
      []
    );
    expect(valuesOf(frames)).toEqual([0, 5, 4, 0]);
  });

  it('clamps buckets aligned outside the range into the edge cells instead of dropping them', () => {
    const frames = aggregateRawLogsVolume(
      [makeTimedFrame([start - 30_000, start + 4 * stepMs + 30_000], [7, 9])],
      extractLevel,
      times,
      []
    );
    const values = valuesOf(frames);
    expect(values).toEqual([7, 0, 0, 9]);
    // the re-bucketing preserves the total hits
    expect(values?.reduce((a: number, v: number) => a + v, 0)).toBe(16);
  });
});

describe('aggregateVolumeFrames time axis', () => {
  const T0 = Date.UTC(2026, 8, 21, 10, 0);
  // 960px → 60 target bars → a 1m grid for the 1h ranges below
  const makeRequest = (fromMs: number, toMs: number) =>
    ({ timezone: 'UTC', maxDataPoints: 960, range: { from: dateTime(fromMs), to: dateTime(toMs), raw: {} } }) as DataQueryRequest<Query>;
  const target: Query = { refId: 'log-volume-A', expr: '*' };
  const timedFrame = (timeMs: number, value: number) =>
    toDataFrame({
      refId: 'log-volume-A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [timeMs] },
        { name: 'Value', type: FieldType.number, values: [value], labels: { level: 'error' } },
      ],
    });
  const points = (frame: DataFrame) => ({
    times: frame.fields.find((f) => f.name === 'Time')!.values,
    values: frame.fields.find((f) => f.name === 'Value')!.values,
  });

  it('places the hits on the calendar bucket grid and zero-fills the empty buckets', () => {
    // 1h → 1m grid; the range starts mid-minute so the first bucket starts before the range
    const from = T0 - 3_600_000 + 30_000;
    const [frame] = aggregateVolumeFrames([timedFrame(T0 - 120_000, 7)], [target], makeRequest(from, T0), []);
    const { times, values } = points(frame);
    expect(times).toHaveLength(60);
    expect(times[0]).toBe(T0 - 3_600_000);
    expect(times[59]).toBe(T0 - 60_000);
    expect(values[58]).toBe(7);
    expect(values.filter((v: number) => v !== 0)).toEqual([7]);
  });

  it('keeps a timestamp that is off the expected grid instead of dropping its hits', () => {
    const [frame] = aggregateVolumeFrames([timedFrame(T0 - 90_000, 3)], [target], makeRequest(T0 - 3_600_000, T0), []);
    const { times, values } = points(frame);
    expect(times).toHaveLength(61);
    expect(values[times.indexOf(T0 - 90_000)]).toBe(3);
  });

  it('sums the hits of several frames for the same bucket', () => {
    const frames = [timedFrame(T0 - 60_000, 2), timedFrame(T0 - 60_000, 5)];
    const [frame] = aggregateVolumeFrames(frames, [target], makeRequest(T0 - 3_600_000, T0), []);
    const { values } = points(frame);
    expect(values[59]).toBe(7);
  });
});

describe('queryLogsVolume', () => {
  const T0 = Date.UTC(2026, 8, 21, 10, 0);
  const makeRange = (fromMs: number, toMs: number) => {
    const from = dateTime(fromMs);
    const to = dateTime(toMs);
    return { from, to, raw: { from, to } };
  };
  // 5 minutes at the default 96 bars → 5s step
  const request = {
    requestId: 'volume',
    timezone: 'UTC',
    range: makeRange(T0 - 5 * 60_000, T0),
    targets: [{ refId: 'log-volume-A', expr: '*', fields: ['level'] }],
  } as unknown as DataQueryRequest<Query>;

  const hitsResponse = (level: string, timeMs: number, state?: LoadingState): DataQueryResponse => ({
    state,
    data: [
      toDataFrame({
        refId: 'log-volume-A',
        fields: [
          { name: 'Time', type: FieldType.time, values: [timeMs] },
          { name: 'Value', type: FieldType.number, values: [1], labels: { level } },
        ],
      }),
    ],
  });

  const seriesNames = (packet: DataQueryResponse) =>
    packet.data.map((frame: DataFrame) => frame.fields.find((f) => f.name === 'Value')?.config.displayNameFromDS);

  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it('emits Loading first and the aggregated volume as Done for a one-shot source without a state', () => {
    scheduler.run(({ cold, flush }) => {
      const source = cold('--(a|)', { a: hitsResponse('error', T0) });
      const packets: DataQueryResponse[] = [];
      queryLogsVolume(request, source, []).subscribe((p) => packets.push(p));
      flush();

      expect(packets.map((p) => p.state)).toEqual([LoadingState.Loading, LoadingState.Done]);
      expect(packets[0].data).toEqual([]);
      expect(seriesNames(packets[1])).toEqual([LogLevel.error]);
      expect(packets[1].data[0].meta?.custom).toEqual({
        targets: request.targets,
        absoluteRange: { from: request.range.from.valueOf(), to: request.range.to.valueOf() },
      });
    });
  });

  it('re-aggregates every Streaming packet of a streaming source and keeps its state', () => {
    scheduler.run(({ cold, flush }) => {
      const source = cold('-a-b-(c|)', {
        a: hitsResponse('error', T0 - 60_000, LoadingState.Streaming),
        b: { state: LoadingState.Streaming, data: [...hitsResponse('error', T0 - 60_000).data, ...hitsResponse('info', T0 - 120_000).data] },
        c: { state: LoadingState.Done, data: [...hitsResponse('error', T0 - 60_000).data, ...hitsResponse('info', T0 - 120_000).data] },
      });
      const packets: DataQueryResponse[] = [];
      queryLogsVolume(request, source, []).subscribe((p) => packets.push(p));
      flush();

      expect(packets.map((p) => p.state)).toEqual([LoadingState.Loading, LoadingState.Streaming, LoadingState.Streaming, LoadingState.Done]);
      expect(seriesNames(packets[1])).toEqual([LogLevel.error]);
      expect(seriesNames(packets[2])).toEqual(expect.arrayContaining([LogLevel.error, LogLevel.info]));
      const plainSeries = (packet: DataQueryResponse) =>
        packet.data.map((frame: DataFrame) => frame.fields.map((f) => [f.name, [...f.values]]));
      expect(plainSeries(packets[3])).toEqual(plainSeries(packets[2]));
    });
  });

  it('emits an Error packet and fails when the source errors', () => {
    const error = new Error('boom');
    const packets: DataQueryResponse[] = [];
    let failure: unknown;
    queryLogsVolume(request, throwError(() => error), []).subscribe({
      next: (p) => packets.push(p),
      error: (e) => (failure = e),
    });

    expect(packets.map((p) => p.state)).toEqual([LoadingState.Loading, LoadingState.Error]);
    expect(packets[1].error).toBe(error);
    expect(failure).toBe(error);
  });

  it('surfaces an in-band response error the same way', () => {
    const error = { message: 'bad query' };
    const packets: DataQueryResponse[] = [];
    let failure: unknown;
    queryLogsVolume(request, of({ data: [], error }), []).subscribe({
      next: (p) => packets.push(p),
      error: (e) => (failure = e),
    });

    expect(packets.map((p) => p.state)).toEqual([LoadingState.Loading, LoadingState.Error]);
    expect(failure).toEqual(error);
  });
});
