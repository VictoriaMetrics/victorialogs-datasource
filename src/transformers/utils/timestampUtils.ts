import { DataFrame, Field, FieldType } from '@grafana/data';

import { Query } from '../../types';
import { getMillisecondsFromDuration } from '../../utils/time/duration';

export const fillTimestampsWithNullValues = (fields: Field[], timestamps: number[]) => {
  const timestampValueMap = new Map();
  fields[0]?.values.forEach((ts, idx) => {
    timestampValueMap.set(ts, fields[1].values[idx] ?? null);
  });

  return timestamps.map((t) => timestampValueMap.get(t) ?? null);
};

export const generateTimestampsWithStep = (
  firstNotNullTimestampMs: number,
  startMs: number,
  endMs: number,
  stepMs: number
) => {
  const result: number[] = [];
  // VictoriaLogs labels a bucket with its grid start, so the bucket that contains 'start'
  // may have a label before 'start'. The axis begins with that bucket to keep its value
  const stepsToFirstTimestamp = Math.floor((startMs - firstNotNullTimestampMs) / stepMs);
  const firstTimestampMs = firstNotNullTimestampMs + stepsToFirstTimestamp * stepMs;

  // Calculate the total number of steps from 'firstTimestamp' to 'end'
  const totalSteps = Math.floor((endMs - firstTimestampMs) / stepMs);

  for (let i = 0; i <= totalSteps; i++) {
    const t = firstTimestampMs + i * stepMs;
    result.push(t.valueOf());
  }

  return result;
};

export const fillFrameWithNullValues = (frame: DataFrame, query: Query, startMs: number, endMs: number): DataFrame => {
  if (!query.step) {
    return frame;
  }

  const timestamps = frame.fields.find((f) => f.type === FieldType.time)?.values as number[];
  const firstTimestamp = timestamps?.[0];
  if (!firstTimestamp) {
    return frame;
  }

  const stepMs = getMillisecondsFromDuration(query.step);
  const timestampsWithNullValues = generateTimestampsWithStep(firstTimestamp, startMs, endMs, stepMs);
  const values = fillTimestampsWithNullValues(frame.fields, timestampsWithNullValues);
  return {
    ...frame,
    fields: [
      {
        ...frame.fields[0],
        values: timestampsWithNullValues,
      },
      {
        ...frame.fields[1],
        values: values,
      },
    ],
  };
};
