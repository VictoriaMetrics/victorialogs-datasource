import { DataFrame, DataFrameType, FieldType } from '@grafana/data';

import { ParsedBucket } from '../types';

export function processHistogramFrames(frames: DataFrame[]): DataFrame[] {
  const buckets: ParsedBucket[] = [];
  for (const frame of frames) {
    const timeField = frame.fields.find((f) => f.type === FieldType.time);
    const valueField = frame.fields.find((f) => f.type === FieldType.number);
    if (!timeField || !valueField) {
      continue;
    }
    const vmrange = valueField.labels?.vmrange;
    if (!vmrange) {
      continue;
    }
    const [minStr, maxStr] = vmrange.split('...');
    const yMin = parseFloat(minStr);
    const yMax = parseFloat(maxStr);
    if (isNaN(yMin) || isNaN(yMax)) {
      continue;
    }
    buckets.push({
      yMin,
      yMax,
      timestamps: timeField.values as number[],
      values: valueField.values as Array<number | null>,
    });
  }
  buckets.sort((a, b) => a.yMin - b.yMin);
  const timestampSet = new Set<number>();
  for (const bucket of buckets) {
    for (const ts of bucket.timestamps) {
      timestampSet.add(ts);
    }
  }
  const timestamps = [...timestampSet].sort((a, b) => a - b);
  const intervalMs =
    timestamps.length > 1 ? timestamps[1] - timestamps[0] : 60000;

  const xMaxValues: number[] = [];
  const yMinValues: number[] = [];
  const yMaxValues: number[] = [];
  const countValues: Array<number | null> = [];
  for (const ts of timestamps) {
    for (const bucket of buckets) {
      const idx = bucket.timestamps.indexOf(ts);
      xMaxValues.push(ts);
      yMinValues.push(bucket.yMin);
      yMaxValues.push(bucket.yMax);
      countValues.push(idx >= 0 ? bucket.values[idx] : 0);
    }
  }
  return [{
    length: xMaxValues.length,
    meta: {
      type: DataFrameType.HeatmapCells,
    },
    fields: [
      {
        name: 'xMax',
        type: FieldType.time,
        config: { interval: intervalMs },
        values: xMaxValues,
      },
      {
        name: 'yMin',
        type: FieldType.number,
        config: {},
        values: yMinValues,
      },
      {
        name: 'yMax',
        type: FieldType.number,
        config: {},
        values: yMaxValues,
      },
      {
        name: 'count',
        type: FieldType.number,
        config: {},
        values: countValues,
      },
    ],
  }];
}
