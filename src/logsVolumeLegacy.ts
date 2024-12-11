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

import { VictoriaLogsDatasource } from "./datasource";
import { Query } from "./types";

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
        const aggregatedLogsVolume = aggregateRawLogsVolume(rawLogsVolume, () => LogLevel.unknown);
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
  extractLevel: (dataFrame: DataFrame) => LogLevel
): DataFrame[] {
  const logsVolumeByLevelMap: Partial<Record<LogLevel, DataFrame[]>> = {};

  rawLogsVolume.forEach((dataFrame) => {
    const level = extractLevel(dataFrame);
    if (!logsVolumeByLevelMap[level]) {
      logsVolumeByLevelMap[level] = [];
    }
    logsVolumeByLevelMap[level]!.push(dataFrame);
  });

  return Object.keys(logsVolumeByLevelMap).map((level: string) => {
    return aggregateFields(
      logsVolumeByLevelMap[level as LogLevel]!,
      getLogVolumeFieldConfig(level as LogLevel)
    );
  });
}

/**
 * Aggregate multiple data frames into a single data frame by adding values.
 * Multiple data frames for the same level are passed here to get a single
 * data frame for a given level. Aggregation by level happens in aggregateRawLogsVolume()
 */
function aggregateFields(dataFrames: DataFrame[], config: FieldConfig): DataFrame {
  const aggregatedDataFrame = new MutableDataFrame();
  if (!dataFrames.length) {
    return aggregatedDataFrame;
  }

  const times = dataFrames.map((dataFrame) => dataFrame.fields[0].values).flat();
  const uniqTimes = Array.from(new Set(times.filter(Boolean))).sort((a, b) => a - b);
  const totalLength = uniqTimes.length;

  if (!totalLength) {
    return aggregatedDataFrame;
  }

  aggregatedDataFrame.addField({ name: 'Time', type: FieldType.time }, totalLength);
  aggregatedDataFrame.addField({ name: 'Value', type: FieldType.number, config }, totalLength);

  for (let pointIndex = 0; pointIndex < totalLength; pointIndex++) {
    const time = uniqTimes[pointIndex]
    const value = dataFrames.reduce((acc, frame) => {
      const [frameTimes, frameValues] = frame.fields
      const targetIndex = frameTimes.values.findIndex(t => t === time)
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
  const color = '#8e8e8e'
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
