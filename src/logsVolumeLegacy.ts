import { sortedLastIndex } from 'lodash';
import { catchError, concat, map, Observable, of, startWith, throwError } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  FieldColorModeId,
  FieldConfig,
  FieldType,
  LoadingState,
  LogLevel,
  MutableDataFrame,
  TimeRange,
  toDataFrame
} from '@grafana/data';
import { BarAlignment, GraphDrawStyle, StackingMode } from '@grafana/schema';

import { LOG_LEVEL_COLOR } from './configuration/LogLevelRules/const';
import { LogLevelRule } from './configuration/LogLevelRules/types';
import { extractLevelFromLabels } from './configuration/LogLevelRules/utils';
import { getRequestVolumeBucketing } from './logsVolume/volumeBucketing';
import { Query } from './types';
import { responseErrors } from './utils/dataQueryResponse';
import { DERIVED_LEVEL_FIELD, parseDerivedLevel } from './utils/query/levelFormatPipes';

/** Cap on the number of series when the volume is grouped by a custom field — VictoriaLogs merges the tail into one bucket */
export const LOGS_VOLUME_GROUPS_LIMIT = 20;
/** Default logs volume grouping — level-based aggregation with level colors */
export const LOGS_VOLUME_DEFAULT_GROUP_BY = 'level';

/** Computes the bucket step (seconds) so a time range is split into `bars` buckets */
export function calculateVolumeStep(range: TimeRange, bars: number): number {
  const totalSeconds = range.to.diff(range.from, 'second');
  return Math.ceil(totalSeconds / bars) || 1;
}

/** Time axis of `bars` evenly spaced buckets starting at range.from, for hits queried with calculateVolumeStep */
export function getUniformVolumeTimeAxis(range: TimeRange, bars: number): number[] {
  const stepMs = calculateVolumeStep(range, bars) * 1000;
  const from = range.from.valueOf();
  return Array.from({ length: bars }, (_, i) => from + i * stepMs);
}

/**
 * Aggregated logs volume of a hits source: emits `Loading`, then one packet per source
 * packet with its state (`Done` when the source has none). Errors surface as an `Error`
 * packet before the stream fails
 */
export const queryLogsVolume = (
  request: DataQueryRequest<Query>,
  source: Observable<DataQueryResponse>,
  rules: LogLevelRule[]
): Observable<DataQueryResponse> => {
  const aggregate = (rawLogsVolume: DataFrame[]): DataFrame[] => {
    const aggregated = aggregateVolumeFrames(rawLogsVolume, request.targets, request, rules);
    if (aggregated[0]) {
      aggregated[0].meta = {
        custom: {
          targets: request.targets,
          absoluteRange: { from: request.range.from.valueOf(), to: request.range.to.valueOf() },
        },
      };
    }
    return aggregated;
  };

  return source.pipe(
    map((response) => {
      // an in-band response error fails the stream like a thrown one
      const [error] = responseErrors(response);
      if (error) {
        throw error;
      }
      // every packet carries the hits of the whole range, so each one is aggregated from scratch
      return { state: response.state ?? LoadingState.Done, data: aggregate(response.data.map(toDataFrame)) };
    }),
    startWith({ state: LoadingState.Loading, data: [] }),
    catchError((error) => concat(of({ state: LoadingState.Error, error, data: [] }), throwError(() => error)))
  );
};

/** Label for the group of logs that don't have the grouping field (empty value in VictoriaLogs) */
const EMPTY_GROUP_LABEL = '(empty)';
/** Label for the tail bucket VictoriaLogs merges the groups beyond fields_limit into (it comes back with no fields at all) */
const OTHER_GROUP_LABEL = 'other';

/** Separator for composite group keys; never occurs in field names or values */
const GROUP_KEY_SEPARATOR = '\u0000';

/** Bucket types in the group key — they keep a literal `other` / `(empty)` field value from colliding with the synthetic buckets */
const GROUP_TYPE_VALUE = 'value';
const GROUP_TYPE_EMPTY = 'empty';
const GROUP_TYPE_OTHER = 'other';

interface GroupBucket {
  label: string;
  frames: DataFrame[];
}

/**
 * Aggregate raw hits frames into logs volume series.
 * Frames whose target is grouped by a custom field become one palette-colored series
 * per field value; the rest go through the level-based aggregation
 */
export function aggregateVolumeFrames(
  rawLogsVolume: DataFrame[],
  targets: Query[],
  request: DataQueryRequest<Query>,
  rules: LogLevelRule[]
): DataFrame[] {
  const groupFieldByRefId = new Map<string, string>();
  targets.forEach((target) => {
    if (target.groupBy && target.groupBy !== LOGS_VOLUME_DEFAULT_GROUP_BY) {
      groupFieldByRefId.set(target.refId, target.groupBy);
    }
  });

  const levelFrames: DataFrame[] = [];
  const customGroups = new Map<string, GroupBucket>();

  rawLogsVolume.forEach((frame) => {
    const groupField = frame.refId ? groupFieldByRefId.get(frame.refId) : undefined;
    if (!groupField) {
      levelFrames.push(frame);
      return;
    }
    const labels = frame.fields.find((f) => f.name === 'Value')?.labels;
    const value = labels?.[groupField];
    const groupType = value === undefined ? GROUP_TYPE_OTHER : value === '' ? GROUP_TYPE_EMPTY : GROUP_TYPE_VALUE;
    const label = value === undefined ? OTHER_GROUP_LABEL : value || EMPTY_GROUP_LABEL;
    // The key includes the grouping field, so equal values of different fields stay
    // separate series, while the same field from several targets merges — mirroring
    // the cross-target aggregation of the level path
    const key = [groupField, groupType, value ?? ''].join(GROUP_KEY_SEPARATOR);
    const bucket = customGroups.get(key) ?? { label, frames: [] };
    bucket.frames.push(frame);
    customGroups.set(key, bucket);
  });

  const times = getVolumeTimeAxis(rawLogsVolume, request);

  return [
    ...aggregateRawLogsVolume(levelFrames, extractLevel, times, rules),
    ...Array.from(customGroups.values(), ({ label, frames }) =>
      aggregateFields(frames, getGroupVolumeFieldConfig(label), times)
    ),
  ];
}

/**
 * Time axis of the volume: the calendar bucket grid of the request range, so empty
 * buckets are zero-filled, plus any timestamp the frames carry off that grid — a
 * bucket VictoriaLogs aligned differently must not lose its hits
 */
function getVolumeTimeAxis(frames: DataFrame[], request: DataQueryRequest<Query>): number[] {
  const times = new Set<number>(getRequestVolumeBucketing(request).bucketStarts);
  frames.forEach((frame) => {
    frame.fields.find((f) => f.type === FieldType.time)?.values.forEach((t: number) => times.add(t));
  });
  return Array.from(times).sort((a, b) => a - b);
}

/**
 * Take multiple data frames, sum up values and group by level.
 * Return a list of data frames, each representing single level.
 */
export function aggregateRawLogsVolume(
  rawLogsVolume: DataFrame[],
  extractLevel: (dataFrame: DataFrame, rules: LogLevelRule[]) => LogLevel,
  times: number[],
  rules: LogLevelRule[]
): DataFrame[] {
  const logsVolumeByLevelMap: Partial<Record<LogLevel, DataFrame[]>> = {};

  rawLogsVolume.forEach((dataFrame) => {
    const level = extractLevel(dataFrame, rules);
    if (!logsVolumeByLevelMap[level]) {
      logsVolumeByLevelMap[level] = [];
    }
    logsVolumeByLevelMap[level]!.push(dataFrame);
  });

  return Object.keys(logsVolumeByLevelMap).map((level: string) => {
    return aggregateFields(
      logsVolumeByLevelMap[level as LogLevel]!,
      getLogVolumeFieldConfig(level as LogLevel),
      times
    );
  });
}

/**
 * Aggregate multiple data frames into a single data frame by adding values on the
 * given time axis (missing points count as zero). Multiple data frames for the same
 * level are passed here to get a single data frame for a given level. Aggregation
 * by level happens in aggregateRawLogsVolume()
 */
function aggregateFields(dataFrames: DataFrame[], config: FieldConfig, times: number[]): DataFrame {
  const aggregatedDataFrame = new MutableDataFrame();
  if (!dataFrames.length || !times.length) {
    return aggregatedDataFrame;
  }

  // Sum-preserving re-bucketing: every source bucket lands in exactly one cell of the axis,
  // so the chart (and its legend totals) always adds up to the raw hits even when
  // VictoriaLogs aligns its buckets differently from the axis
  const sums = new Array<number>(times.length).fill(0);
  dataFrames.forEach((frame) => {
    const [frameTimes, frameValues] = frame.fields;
    frameTimes.values.forEach((time: number, i: number) => {
      sums[findTimeCell(times, time)] += frameValues.values[i] ?? 0;
    });
  });

  aggregatedDataFrame.addField({ name: 'Time', type: FieldType.time }, times.length);
  aggregatedDataFrame.addField({ name: 'Value', type: FieldType.number, config }, times.length);
  times.forEach((time, pointIndex) => {
    aggregatedDataFrame.set(pointIndex, { Time: time, Value: sums[pointIndex] });
  });

  return aggregatedDataFrame;
}

/** Cell of the last axis time at or before `time`; a bucket aligned before the axis folds into the first cell */
const findTimeCell = (times: number[], time: number): number => Math.max(0, sortedLastIndex(times, time) - 1);

/**
 * Returns field configuration used to render logs volume bars
 */
function getLogVolumeFieldConfig(level: LogLevel) {
  const name = LogLevel[level as unknown as keyof typeof LogLevel] ?? LogLevel.unknown;
  const color = LOG_LEVEL_COLOR[name] || LOG_LEVEL_COLOR[LogLevel.unknown];
  return {
    displayNameFromDS: name,
    color: {
      mode: FieldColorModeId.Fixed,
      fixedColor: color,
    },
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      barAlignment: BarAlignment.Center,
      lineColor: color,
      pointColor: color,
      fillColor: color,
      lineWidth: 1,
      fillOpacity: 100,
      stacking: {
        mode: StackingMode.Normal,
        group: 'A',
      },
    },
  };
}

/**
 * Returns field configuration for a series of the volume grouped by a custom field
 */
function getGroupVolumeFieldConfig(name: string): FieldConfig {
  return {
    displayNameFromDS: name,
    color: {
      mode: FieldColorModeId.PaletteClassic,
    },
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      barAlignment: BarAlignment.Center,
      lineWidth: 1,
      fillOpacity: 100,
      stacking: {
        mode: StackingMode.Normal,
        group: 'A',
      },
    },
  };
}

/** Resolves the log level of a volume frame from its value-field labels */
export const extractLevel = (frame: DataFrame, rules: LogLevelRule[]): LogLevel => {
  const valueField = frame.fields.find(f => f.name === 'Value');

  if (!valueField?.labels) {
    return LogLevel.unknown;
  }

  // The derived label is written by our own `format` pipes (see levelFormatPipes.ts),
  // so its value is authoritative: empty means "no pipe matched" → unknown,
  // and client-side rule matching must not run again
  const derivedLevel = valueField.labels[DERIVED_LEVEL_FIELD];
  if (derivedLevel !== undefined) {
    return parseDerivedLevel(derivedLevel);
  }

  return extractLevelFromLabels(valueField.labels, rules);
};
