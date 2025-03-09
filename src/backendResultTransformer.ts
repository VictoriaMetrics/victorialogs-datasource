import {
  CoreApp,
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  FieldType,
  isDataFrame,
  QueryResultMeta,
} from '@grafana/data';

import { getDerivedFields } from './getDerivedFields';
import { makeTableFrames } from './makeTableFrames';
import { getHighlighterExpressionsFromQuery } from './queryUtils';
import { dataFrameHasError } from './responseUtils';
import { DerivedFieldConfig, Query, QueryType } from './types';

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

function processStreamsFrames(
  frames: DataFrame[],
  queryMap: Map<string, Query>,
  derivedFieldConfigs: DerivedFieldConfig[],
  app: string
): DataFrame[] {
  return frames.map((frame) => {
    const query = frame.refId !== undefined ? queryMap.get(frame.refId) : undefined;
    if (app === CoreApp.Dashboard) return processDashboardStreamFrame(frame, query, derivedFieldConfigs);
    return processStreamFrame(frame, query, derivedFieldConfigs);
  });
}

function processStreamFrame(
  frame: DataFrame,
  query: Query | undefined,
  derivedFieldConfigs: DerivedFieldConfig[]
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

  const newFrame = setFrameMeta(frame, meta);
  const derivedFields = getDerivedFields(newFrame, derivedFieldConfigs);
  return {
    ...newFrame,
    fields: [...newFrame.fields, ...derivedFields],
  };
}

function processDashboardStreamFrame(
  frame: DataFrame,
  query: Query | undefined,
  derivedFieldConfigs: DerivedFieldConfig[]
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

  const newFrame = setFrameMeta(frame, meta);
  const derivedFields = getDerivedFields(newFrame, derivedFieldConfigs);

  return {
    ...newFrame,
    fields: [
      ...newFrame.fields.map((field) => {
        if (field.name === 'labels') {
          return {
            ...field,
            values: field.values.map((value) => {
              return Object.entries(value).map(([key, value]) => {
                return `${key}: ${JSON.stringify(value)}`;
              });
            }),
          };
        }
        return field;
      }),
      ...derivedFields,
    ],
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
  derivedFieldConfigs: DerivedFieldConfig[]
): DataQueryResponse {
  const { data, errors, ...rest } = response;
  const queries = request.targets;
  const { app } = request;

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
      ...processStreamsFrames(streamsFrames, queryMap, derivedFieldConfigs, app),
    ],
  };
}
