import { from, isObservable, Observable } from "rxjs";

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
  toDataFrame
} from "@grafana/data";
import { BarAlignment, GraphDrawStyle, StackingMode } from "@grafana/schema";

import { LOG_LEVEL_COLOR } from "./configuration/LogLevelRules/const";
import { LogLevelRule } from "./configuration/LogLevelRules/types";
import { resolveLogLevel } from "./configuration/LogLevelRules/utils";
import { VictoriaLogsDatasource } from "./datasource";
import { Query } from "./types";

export const LOGS_VOLUME_BARS = 100;

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
        const aggregatedLogsVolume = aggregateRawLogsVolume(rawLogsVolume, extractLevel, request, datasource.logLevelRules);
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
}

/**
 * Take multiple data frames, sum up values and group by level.
 * Return a list of data frames, each representing single level.
 */
export function aggregateRawLogsVolume(
  rawLogsVolume: DataFrame[],
  extractLevel: (dataFrame: DataFrame, rules: LogLevelRule[]) => LogLevel,
  request: DataQueryRequest<Query>,
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
      request
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
  request: DataQueryRequest<Query>
): DataFrame {
  const aggregatedDataFrame = new MutableDataFrame();
  if (!dataFrames.length) {
    return aggregatedDataFrame;
  }

  const totalSeconds = request.range.to.diff(request.range.from, "second");
  const step = Math.ceil(totalSeconds / LOGS_VOLUME_BARS) || 1;
  const uniqTimes = Array.from(
    { length: LOGS_VOLUME_BARS },
    (_, i) => request.range.from.valueOf() + i * step * 1000
  );
  const totalLength = uniqTimes.length;

  if (!totalLength) {
    return aggregatedDataFrame;
  }

  aggregatedDataFrame.addField({ name: 'Time', type: FieldType.time }, totalLength);
  aggregatedDataFrame.addField({ name: 'Value', type: FieldType.number, config }, totalLength);

  for (let pointIndex = 0; pointIndex < totalLength; pointIndex++) {
    const time = uniqTimes[pointIndex];
    const value = dataFrames.reduce((acc, frame) => {
      const [frameTimes, frameValues] = frame.fields;
      const targetIndex = frameTimes.values.findIndex(t => Math.abs(t - time) < step * 1000 / 2);
      return acc + (targetIndex !== -1 ? frameValues.values[targetIndex] : 0);
    }, 0);
    aggregatedDataFrame.set(pointIndex, { Value: value, Time: time });
  }

  return aggregatedDataFrame;
}

/**
 * Returns field configuration used to render logs volume bars
 */
function getLogVolumeFieldConfig(level: LogLevel) {
  const name = level;
  const color = LOG_LEVEL_COLOR[level as LogLevel] || LOG_LEVEL_COLOR[LogLevel.unknown];
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

function isValidLogLevel(level: string): boolean {
  return Object.values(LogLevel).includes(level as LogLevel);
}

const extractLevel = (frame: DataFrame, rules: LogLevelRule[]): LogLevel => {
  if (rules.length === 0) {
    // If there are no rules, we don't need to add the level field
    return LogLevel.unknown;
  }

  const valueField = frame.fields.find(f => f.name === 'Value');

  if (!valueField?.labels) {
    return LogLevel.unknown;
  }

  const hasInfoLabel = Object.entries(valueField.labels).some(([key, value]) => {
    return key === 'level' && value !== undefined && value !== null && isValidLogLevel(value.toLowerCase());
  })
  if (hasInfoLabel) {
    // If the labels field already has a 'level' label, we don't need to add the level field
    return valueField.labels['level'] as LogLevel;
  }


  return resolveLogLevel(valueField.labels, rules);
}
