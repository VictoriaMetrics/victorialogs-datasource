import {
  DataFrame,
  DataFrameType,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  Field,
  FieldType,
  isDataFrame,
  QueryResultMeta
} from '@grafana/data';

import { LogLevelRule } from './configuration/LogLevelRules/types';
import { extractLevelFromLabels } from './configuration/LogLevelRules/utils';
import { getDerivedFields } from './getDerivedFields';
import { makeTableFrames } from './makeTableFrames';
import { getHighlighterExpressionsFromQuery } from './queryUtils';
import { dataFrameHasError } from './responseUtils';
import { DerivedFieldConfig, Query, QueryType } from './types';
import { getMillisecondsFromDuration } from './utils/timeUtils';

const ANNOTATIONS_REF_ID = 'Anno';

enum FrameField {
  Labels = 'labels',
  Line = 'Line',
  /**
   * The name of the label that is added to the log line to indicate the calculated log level according to the log level rules
   * Grafana supports only `detected_level` and `level` label names. Apps often use 'level' for the log level,
   * so to avoid duplication and confusion of overwritten 'level' labels, we use 'detected_level' instead.
   * */
  DetectedLevel = 'detected_level'
}

function isMetricFrame(frame: DataFrame): boolean {
  return frame.fields.every((field) => field.type === FieldType.time || field.type === FieldType.number);
}

// returns a new frame, with meta shallow merged with its original meta
function setFrameMeta(frame: DataFrame, meta: QueryResultMeta): DataFrame {
  const { meta: oldMeta, ...rest } = frame;
  // meta maybe be undefined, we need to handle that
  const newMeta = { ...oldMeta, ...meta, };
  return {
    ...rest,
    meta: {
      ...newMeta,
      typeVersion: [0, 1],
    },
  };
}

function addLevelField(frame: DataFrame, rules: LogLevelRule[]): DataFrame {
  const rows = frame.length ?? frame.fields[0]?.values.length ?? 0;
  const lineField = frame.fields.find(f => f.name === FrameField.Line);
  const labelsField = frame.fields.find(f => f.name === FrameField.Labels);

  const levelValues = Array.from({ length: rows }, (_, idx) => {
    const labels = (labelsField?.values[idx] ?? {}) as Record<string, string>;
    const msg = lineField?.values[idx] ?? '';
    const labelsWithMsg = { ...labels, _msg: msg };
    return extractLevelFromLabels(labelsWithMsg, rules);
  });

  const levelField: Field = {
    name: FrameField.DetectedLevel,
    type: FieldType.string,
    config: {},
    values: levelValues,
  };

  return { ...frame, fields: [...frame.fields, levelField] };
}

function getStreamIds(frame: DataFrame) {
  const labelsField = frame.fields.find(f => f.name === FrameField.Labels);
  if (!labelsField) {
    return [];
  }
  return labelsField?.values.map(labels => labels._stream_id);
}

function transformDashboardLabelField(field: Field): Field {
  if (field.name !== FrameField.Labels) {
    return field;
  }

  return {
    ...field,
    values: field.values.map((value) => {
      return Object.entries(value).map(([key, val]) => {
        return `${key}: ${JSON.stringify(val)}`;
      });
    }),
  };
}

function getStreamFields(fields: Field[], transformLabels: boolean): Field[] {
  if (!transformLabels) {
    return fields;
  }

  return fields.map(transformDashboardLabelField);
}

function processStreamsFrames(
  frames: DataFrame[],
  queryMap: Map<string, Query>,
  derivedFieldConfigs: DerivedFieldConfig[],
  logLevelRules: LogLevelRule[]
): DataFrame[] {
  return frames.map((frame) => {
    const query = frame.refId !== undefined ? queryMap.get(frame.refId) : undefined;
    const isAnnotations = query?.refId === ANNOTATIONS_REF_ID;
    return processStreamFrame(frame, query, derivedFieldConfigs, logLevelRules, isAnnotations);
  });
}

function processStreamFrame(
  frame: DataFrame,
  query: Query | undefined,
  derivedFieldConfigs: DerivedFieldConfig[],
  logLevelRules: LogLevelRule[],
  transformLabels = false
): DataFrame {
  const custom: Record<string, string> = {
    ...frame.meta?.custom, // keep the original meta.custom
  };

  if (dataFrameHasError(frame)) {
    custom.error = 'Error when parsing some of the logs';
  }

  const meta: QueryResultMeta = {
    preferredVisualisationType: 'logs',
    limit: query?.maxLines,
    searchWords: query !== undefined ? getHighlighterExpressionsFromQuery(query.expr) : undefined,
    custom: {
      ...custom,
      // if the user decides to hide labels via transforms so that we can get the streamId for `Log context`
      streamIds: getStreamIds(frame),
    },
  };

  const frameWithMeta = setFrameMeta(frame, meta);
  const frameWithLevel = addLevelField(frameWithMeta, logLevelRules);

  const derivedFields = getDerivedFields(frameWithLevel, derivedFieldConfigs);
  const baseFields = getStreamFields(frameWithLevel.fields, transformLabels);

  return {
    ...frameWithLevel,
    fields: [
      ...baseFields,
      ...derivedFields
    ]
  };
}

function processMetricInstantFrames(frames: DataFrame[]): DataFrame[] {
  return frames.length > 0 ? makeTableFrames(frames) : [];
}

const fillTimestampsWithNullValues = (fields: Field[], timestamps: number[]) => {
  const timestampValueMap = new Map();
  fields[0]?.values.forEach((ts, idx) => {
    timestampValueMap.set(ts, fields[1].values[idx] || null);
  });

  return timestamps.map(t => timestampValueMap.get(t) || null);
};

const generateTimestampsWithStep = (firstNotNullTimestampMs: number, startMs: number, endMs: number, stepMs: number) => {
  const result: number[] = [];
  const stepsToFirstTimestamp = Math.ceil((startMs - firstNotNullTimestampMs) / stepMs);
  let firstTimestampMs = firstNotNullTimestampMs + (stepsToFirstTimestamp * stepMs);

  // If the first timestamp is before 'start', set it to 'start'
  if (firstTimestampMs < startMs) {
    firstTimestampMs = startMs;
  }

  // Calculate the total number of steps from 'firstTimestamp' to 'end'
  const totalSteps = Math.floor((endMs - firstTimestampMs) / stepMs);

  for (let i = 0; i <= totalSteps; i++) {
    const t = firstTimestampMs + (i * stepMs);
    result.push(t.valueOf());
  }

  return result;
};

const fillFrameWithNullValues = (frame: DataFrame, query: Query, startMs: number, endMs: number): DataFrame => {
  if (!query.step) {
    return frame;
  }

  const timestamps = frame.fields.find(f => f.type === FieldType.time)?.values as number[];
  const firstTimestamp = timestamps?.[0];
  if (!firstTimestamp) {
    return frame;
  }

  const stepMs = getMillisecondsFromDuration(query.step);
  const timestampsWithNullValues = generateTimestampsWithStep(firstTimestamp, startMs, endMs, stepMs);
  const values = fillTimestampsWithNullValues(frame.fields, timestampsWithNullValues);
  return {
    ...frame,
    fields: [{
      ...frame.fields[0],
      values: timestampsWithNullValues,
    }, {
      ...frame.fields[1],
      values: values,
    }]
  };
};

function getQueryMap(queries: Query[]) {
  return new Map(queries.map((query) => [query.refId, query]));
}

function processMetricRangeFrames(frames: DataFrame[], queries: Query[], startTime: number, endTime: number): DataFrame[] {
  const meta: QueryResultMeta = { preferredVisualisationType: 'graph', type: DataFrameType.TimeSeriesMulti };
  const queryMap = getQueryMap(queries);

  return frames.map((frame) => {
    const query = queryMap.get(frame.refId || '');
    // need to fill missing timestamps with null values, so grafana can render the graph properly
    const frameWithNullValues = query ? fillFrameWithNullValues(frame, query, startTime, endTime) : frame;
    return setFrameMeta(frameWithNullValues, meta);
  });
}

// we split the frames into 3 groups, because we will handle
// each group slightly differently
function groupFrames(
  frames: DataFrame[],
  queryMap: Map<string, Query>
): {
  streamsFrames: DataFrame[];
  metricInstantFrames: DataFrame[];
  metricRangeFrames: DataFrame[];
} {
  const streamsFrames: DataFrame[] = [];
  const metricInstantFrames: DataFrame[] = [];
  const metricRangeFrames: DataFrame[] = [];

  frames.forEach((frame) => {
    if (!isMetricFrame(frame)) {
      streamsFrames.push(frame);
    } else {
      const isInstantFrame = frame.refId != null && queryMap.get(frame.refId)?.queryType === QueryType.Instant;
      if (isInstantFrame) {
        metricInstantFrames.push(frame);
      } else {
        metricRangeFrames.push(frame);
      }
    }
  });

  return { streamsFrames, metricInstantFrames, metricRangeFrames };
}

function improveError(error: DataQueryError | undefined, queryMap: Map<string, Query>): DataQueryError | undefined {
  if (error === undefined) {
    return error;
  }

  const { refId, message } = error;
  if (refId === undefined || message === undefined) {
    return error;
  }

  const query = queryMap.get(refId);
  if (query === undefined) {
    return error;
  }

  if (message.includes('escape') && query.expr.includes('\\')) {
    return {
      ...error,
      message: `${message}. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://docs.victoriametrics.com/victorialogs/logsql/.`,
    };
  }

  return error;
}

export function transformBackendResult(
  response: DataQueryResponse,
  request: DataQueryRequest<Query>,
  derivedFieldConfigs: DerivedFieldConfig[],
  logLevelRules: LogLevelRule[],
): DataQueryResponse {
  const { data, errors, ...rest } = response;
  const queries = request.targets;

  // in the typescript type, data is an array of basically anything.
  // we do know that they have to be dataframes, so we make a quick check,
  // this way we can be sure, and also typescript is happy.
  const dataFrames = data.map((d) => {
    if (!isDataFrame(d)) {
      throw new Error('transformation only supports dataframe responses');
    }

    return d;
  });

  const queryMap = new Map(queries.map((query) => [query.refId, query])) as Map<string, Query>;

  const { streamsFrames, metricInstantFrames, metricRangeFrames } = groupFrames(dataFrames, queryMap);

  const improvedErrors = errors && errors.map((error) => improveError(error, queryMap)).filter((e) => e !== undefined);

  return {
    ...rest,
    errors: improvedErrors as DataQueryError[],
    data: [
      ...processMetricRangeFrames(metricRangeFrames, request.targets, request.range.from.valueOf(), request.range.to.valueOf()),
      ...processMetricInstantFrames(metricInstantFrames),
      ...processStreamsFrames(streamsFrames, queryMap, derivedFieldConfigs, logLevelRules),
    ],
  };
}
