import { DataFrame, DataFrameType, FieldType } from '@grafana/data';

import { ParsedBucket } from '../../types';

import { groupFramesByLabels, parseBucketFromFrame } from './utils';

/**
 * Converts a list of frames (belonging to one label group) into a single HeatmapCells DataFrame.
 */
function buildHeatmapFrame(frames: DataFrame[]): DataFrame {
  const buckets: ParsedBucket[] = [];
  for (const frame of frames) {
    const bucket = parseBucketFromFrame(frame);
    if (bucket) {
      buckets.push(bucket);
    }
  }
  buckets.sort((a, b) => a.yMin - b.yMin);

  const timestampSet = new Set<number>();
  const bucketTimestampMaps: Map<number, number>[] = [];
  for (const bucket of buckets) {
    const tsMap = new Map<number, number>();
    bucket.timestamps.forEach((ts, idx) => {
      timestampSet.add(ts);
      tsMap.set(ts, idx);
    });
    bucketTimestampMaps.push(tsMap);
  }
  const timestamps = [...timestampSet].sort((a, b) => a - b);
  const intervalMs = timestamps.length > 1 ? timestamps[1] - timestamps[0] : 60000;

  const xMaxValues: number[] = [];
  const yMinValues: number[] = [];
  const yMaxValues: number[] = [];
  const countValues: Array<number | null> = [];
  for (const ts of timestamps) {
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const idx = bucketTimestampMaps[i].get(ts);
      xMaxValues.push(ts);
      yMinValues.push(bucket.yMin);
      yMaxValues.push(bucket.yMax);
      countValues.push(idx !== undefined ? bucket.values[idx] : 0);
    }
  }

  return {
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
  };
}

/**
 * Processes histogram frames into HeatmapCells format.
 * Groups frames by non-vmrange labels and produces one HeatmapCells DataFrame per group.
 */
export function processHistogramToHeatmap(frames: DataFrame[]): DataFrame[] {
  if (frames.length === 0) {
    return [];
  }

  const groups = groupFramesByLabels(frames);
  const result: DataFrame[] = [];
  for (const groupFrames of groups.values()) {
    result.push(buildHeatmapFrame(groupFrames));
  }
  return result;
}
