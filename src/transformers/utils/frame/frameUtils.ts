import { omit } from 'lodash';

import { DataFrame, Field, FieldType, Labels, QueryResultMeta } from '@grafana/data';

import { Query, QueryType } from '../../../types';
import { FrameField } from '../../types';

export function isMetricFrame(frame: DataFrame): boolean {
  return frame.fields.every((field) => field.type === FieldType.time || field.type === FieldType.number);
}

// returns a new frame, with meta shallow merged with its original meta
export function setFrameMeta(frame: DataFrame, meta: QueryResultMeta): DataFrame {
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

export function getQueryMap(queries: Query[]) {
  return new Map(queries.map((query) => [query.refId, query]));
}

// we split the frames into 3 groups, because we will handle
// each group slightly differently
export function groupFrames(
  frames: DataFrame[],
  queryMap: Map<string, Query>
): {
  streamsFrames: DataFrame[];
  metricInstantFrames: DataFrame[];
  metricRangeFrames: DataFrame[];
  histogramFrames: DataFrame[];
} {
  const streamsFrames: DataFrame[] = [];
  const metricInstantFrames: DataFrame[] = [];
  const metricRangeFrames: DataFrame[] = [];
  const histogramFrames: DataFrame[] = [];

  frames.forEach((frame) => {
    const isHistogramFrame = frame.refId != null && queryMap.get(frame.refId)?.format === 'histogram';
    if (isHistogramFrame) {
      histogramFrames.push(frame);
      return;
    }

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

  return { streamsFrames, metricInstantFrames, metricRangeFrames, histogramFrames };
}

export function dataFrameHasError(frame: DataFrame): boolean {
  const labelSets: Labels[] = frame.fields.find((f) => f.name === 'labels')?.values ?? [];
  return labelSets.some((labels) => labels.__error__ !== undefined);
}

/** A logs frame without rows; Explore recognises a logs result by `preferredVisualisationType` and the Time/Line field pair */
export const emptyLogsFrame = (refId: string): DataFrame => ({
  refId,
  length: 0,
  fields: [
    { name: 'Time', type: FieldType.time, config: {}, values: [] },
    { name: FrameField.Line, type: FieldType.string, config: {}, values: [] },
  ],
  meta: { preferredVisualisationType: 'logs' },
});

/**
 * The rows of `next` after the rows of `frame`. Both are logs frames of one query, so their fields line up.
 * The custom meta of both is kept, so a parsing error of either part is reported.
 */
export const appendLogsFrame = (frame: DataFrame, next: DataFrame): DataFrame => ({
  ...frame,
  meta: { ...frame.meta, custom: { ...next.meta?.custom, ...frame.meta?.custom } },
  length: frame.length + next.length,
  fields: frame.fields.map((field, i) => appendField(field, next.fields[i])),
});

const appendField = (field: Field, next: Field): Field => ({
  ...omit(field, 'state'),
  values: field.values.concat(next.values),
  nanos: field.nanos || next.nanos ? nanosOf(field).concat(nanosOf(next)) : undefined,
});

const nanosOf = (field: Field): number[] => field.nanos ?? Array(field.values.length).fill(0);
