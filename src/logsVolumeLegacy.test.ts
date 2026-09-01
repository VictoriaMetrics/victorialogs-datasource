import { DataQueryRequest, dateTime, FieldColorModeId, FieldType, LogLevel, toDataFrame } from '@grafana/data';

import { LOG_LEVEL_COLOR } from './configuration/LogLevelRules/const';
import { LogLevelRuleType } from './configuration/LogLevelRules/types';
import { aggregateRawLogsVolume, aggregateVolumeFrames, extractLevel } from './logsVolumeLegacy';
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
  const request = {
    range: {
      from: dateTime('2026-07-06T00:00:00Z'),
      to: dateTime('2026-07-06T01:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    },
  } as DataQueryRequest<Query>;

  const valueConfig = (frames: ReturnType<typeof aggregateRawLogsVolume>) =>
    frames[0].fields.find((f) => f.name === 'Value')?.config;

  it('canonicalizes an alias level label — `warn` colors the series as warning, not unknown', () => {
    // extractLevelFromLabels passes the raw label value through, so the alias reaches the styling
    const frames = aggregateRawLogsVolume([makeFrame({ level: 'warn' })], extractLevel, request, []);
    expect(frames).toHaveLength(1);
    expect(valueConfig(frames)?.displayNameFromDS).toBe(LogLevel.warning);
    expect(valueConfig(frames)?.color?.fixedColor).toBe(LOG_LEVEL_COLOR[LogLevel.warning]);
  });

  it('renders an unspecified ("") level as unknown', () => {
    const frames = aggregateRawLogsVolume([makeFrame()], () => LogLevel.unspecified, request, []);
    expect(valueConfig(frames)?.displayNameFromDS).toBe(LogLevel.unknown);
    expect(valueConfig(frames)?.color?.fixedColor).toBe(LOG_LEVEL_COLOR[LogLevel.unknown]);
  });
});

describe('aggregateVolumeFrames custom grouping', () => {
  const request = {
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
