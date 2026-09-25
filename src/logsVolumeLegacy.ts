import { from, isObservable, Observable } from 'rxjs';

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
import { VictoriaLogsDatasource } from './datasource';
import { Query } from './types';
import { DERIVED_LEVEL_FIELD, parseDerivedLevel } from './utils/query/levelFormatPipes';

export const LOGS_VOLUME_BARS = 100;
/** Cap on the number of series when the volume is grouped by a custom field — VictoriaLogs merges the tail into one bucket */
export const LOGS_VOLUME_GROUPS_LIMIT = 20;
/** Default logs volume grouping — level-based aggregation with level colors */
export const LOGS_VOLUME_DEFAULT_GROUP_BY = 'level';

/** Computes the bucket step (seconds) so a time range is split into `bars` buckets */
export function calculateVolumeStep(range: TimeRange, bars = LOGS_VOLUME_BARS): number {
  const totalSeconds = range.to.diff(range.from, 'second');
  return Math.ceil(totalSeconds / bars) || 1;
}

export const queryLogsVolume = (datasource: VictoriaLogsDatasource, request: DataQueryRequest<Query>): Observable<DataQueryResponse> | undefined => {
  return new Observable((observer) => {
    let rawLogsVolume: DataFrame[] = [];
    observer.next({
      state: LoadingState.Loading,
      error: undefined,
      data: [],
    });

    const queryResponse = datasource.query(request);
    const queryObservable = isObservable(queryResponse) ? queryResponse : from(queryResponse);

    const subscription = queryObservable.subscribe({
      complete: () => {
        const aggregatedLogsVolume = aggregateVolumeFrames(rawLogsVolume, request.targets, request, datasource.logLevelRules);
        if (aggregatedLogsVolume[0]) {
          aggregatedLogsVolume[0].meta = {
            custom: {
              targets: request.targets,
              absoluteRange: { from: request.range.from.valueOf(), to: request.range.to.valueOf() },
            },
          };
        }
        observer.next({
          state: LoadingState.Done,
          error: undefined,
          data: aggregatedLogsVolume,
        });
        observer.complete();
      },
      next: (dataQueryResponse: DataQueryResponse) => {
        const { error } = dataQueryResponse;
        if (error !== undefined) {
          observer.next({
            state: LoadingState.Error,
            error,
            data: [],
          });
          observer.error(error);
        } else {
          rawLogsVolume = rawLogsVolume.concat(dataQueryResponse.data.map(toDataFrame));
        }
      },
      error: (error) => {
        observer.next({
          state: LoadingState.Error,
          error: error,
          data: [],
        });
        observer.error(error);
      },
    });
    return () => {
      subscription?.unsubscribe();
    };
  });
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

  return [
    ...aggregateRawLogsVolume(levelFrames, extractLevel, request, rules),
    ...Array.from(customGroups.values(), ({ label, frames }) =>
      aggregateFields(frames, getGroupVolumeFieldConfig(label), request)
    ),
  ];
}

/**
 * Take multiple data frames, sum up values and group by level.
 * Return a list of data frames, each representing single level.
 */
export function aggregateRawLogsVolume(
  rawLogsVolume: DataFrame[],
  extractLevel: (dataFrame: DataFrame, rules: LogLevelRule[]) => LogLevel,
  request: DataQueryRequest<Query>,
  rules: LogLevelRule[],
  bars = LOGS_VOLUME_BARS
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
      request,
      bars
    );
  });
}

/**
 * Aggregate multiple data frames into a single data frame by adding values.
 * Multiple data frames for the same level are passed here to get a single
 * data frame for a given level. Aggregation by level happens in aggregateRawLogsVolume()
 */
function aggregateFields(
  dataFrames: DataFrame[],
  config: FieldConfig,
  request: DataQueryRequest<Query>,
  bars = LOGS_VOLUME_BARS
): DataFrame {
  const aggregatedDataFrame = new MutableDataFrame();
  if (!dataFrames.length) {
    return aggregatedDataFrame;
  }

  const stepMs = calculateVolumeStep(request.range, bars) * 1000;
  const from = request.range.from.valueOf();

  aggregatedDataFrame.addField({ name: 'Time', type: FieldType.time }, bars);
  aggregatedDataFrame.addField({ name: 'Value', type: FieldType.number, config }, bars);

  // Sum-preserving re-bucketing: every source bucket lands in exactly one grid cell, so the
  // chart (and its legend totals) always adds up to the raw hits. The previous nearest-match
  // lookup dropped edge buckets — VictoriaLogs aligns its buckets to an absolute step grid,
  // the display grid starts at range.from, and with bars+1 source buckets on bars grid points
  // at least one bucket found no grid point within half a step and silently vanished.
  const sums = new Array<number>(bars).fill(0);
  for (const frame of dataFrames) {
    const [frameTimes, frameValues] = frame.fields;
    frameTimes.values.forEach((t: number, i: number) => {
      // clamp: the first/last VL buckets are aligned outside [from, to) but still hold
      // in-range hits — fold them into the edge cells instead of dropping them
      const cell = Math.min(bars - 1, Math.max(0, Math.floor((t - from) / stepMs)));
      sums[cell] += frameValues.values[i] ?? 0;
    });
  }

  for (let pointIndex = 0; pointIndex < bars; pointIndex++) {
    aggregatedDataFrame.set(pointIndex, { Value: sums[pointIndex], Time: from + pointIndex * stepMs });
  }

  return aggregatedDataFrame;
}

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
