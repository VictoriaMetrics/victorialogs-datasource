import {
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  Field,
  FieldType,
  LogLevel,
  QueryResultMeta,
  isDataFrame,
} from '@grafana/data';

import { LogLevelRule } from "./configuration/LogLevelRules/types";
import { resolveLogLevel } from "./configuration/LogLevelRules/utils";
import { getDerivedFields } from './getDerivedFields';
import { makeTableFrames } from './makeTableFrames';
import { getHighlighterExpressionsFromQuery } from './queryUtils';
import { dataFrameHasError } from './responseUtils';
import { DerivedFieldConfig, Query, QueryType } from './types';

const ANNOTATIONS_REF_ID = 'Anno';

enum FrameField {
  Labels = 'labels',
  Level = 'level'
}

function isMetricFrame(frame: DataFrame): boolean {
  return frame.fields.every((field) => field.type === FieldType.time || field.type === FieldType.number);
}

// returns a new frame, with meta shallow merged with its original meta
function setFrameMeta(frame: DataFrame, meta: QueryResultMeta): DataFrame {
  const { meta: oldMeta, ...rest } = frame;
  // meta maybe be undefined, we need to handle that
  const newMeta = { ...oldMeta, ...meta };
  return {
    ...rest,
    meta: newMeta,
  };
}

function addLevelField(frame: DataFrame, rules: LogLevelRule[]): DataFrame {
  const rows = frame.length ?? frame.fields[0]?.values.length ?? 0;
  const labelsField = frame.fields.find(f => f.name === FrameField.Labels);

  const levelValues: LogLevel[] = Array.from({ length: rows }, (_, idx) => {
    const labels = (labelsField?.values[idx] ?? {}) as Record<string, any>;
    return resolveLogLevel(labels, rules);
  });

  const levelField: Field<LogLevel> = {
    name: FrameField.Level,
    type: FieldType.string,
    config: {},
    values: levelValues,
  };

  return { ...frame, fields: [...frame.fields, levelField] };
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
    const isAnnotations = query?.refId === ANNOTATIONS_REF_ID
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
    custom,
  };

  const frameWithMeta = setFrameMeta(frame, meta);
  const frameWithLevel = addLevelField(frameWithMeta, logLevelRules);

  const derivedFields = getDerivedFields(frameWithLevel, derivedFieldConfigs);
  const baseFields = getStreamFields(frameWithLevel.fields, transformLabels)

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

function processMetricRangeFrames(frames: DataFrame[]): DataFrame[] {
  const meta: QueryResultMeta = { preferredVisualisationType: 'graph' };
  return frames.map((frame) => setFrameMeta(frame, meta));
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
  request: DataQueryRequest,
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
      ...processMetricRangeFrames(metricRangeFrames),
      ...processMetricInstantFrames(metricInstantFrames),
      ...processStreamsFrames(streamsFrames, queryMap, derivedFieldConfigs, logLevelRules),
    ],
  };
}
