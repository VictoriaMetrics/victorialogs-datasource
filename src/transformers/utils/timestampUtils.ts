import { DataFrame, Field, FieldType } from '@grafana/data';

import { Query } from '../../types';
import { getMillisecondsFromDuration } from '../../utils/timeUtils';

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
  const stepsToFirstTimestamp = Math.ceil((startMs - firstNotNullTimestampMs) / stepMs);
  let firstTimestampMs = firstNotNullTimestampMs + stepsToFirstTimestamp * stepMs;

  // If the first timestamp is before 'start', set it to 'start'
  if (firstTimestampMs < startMs) {
    firstTimestampMs = startMs;
  }

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
