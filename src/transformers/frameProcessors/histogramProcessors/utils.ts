import { DataFrame, FieldType } from '@grafana/data';

import { ParsedBucket } from '../../types';

export const IGNORED_LABELS = new Set(['vmrange', '__name__']);

/**
 * Formats a bucket range from yMin/yMax into a human-readable string.
 * Example: yMin=1000000, yMax=1136000 → "1000000 - 1136000"
 */
export function formatBucketRange(yMin: number, yMax: number): string {
  return `${String(yMin)} - ${String(yMax)}`;
}

/**
 * Returns a stable string key for labels, ignoring vmrange and __name__.
 * Labels are sorted alphabetically by key for deterministic grouping.
 */
export function getLabelGroupKey(labels: Record<string, string> | undefined): string {
  if (!labels) {
    return '';
  }
  return Object.keys(labels)
    .filter((k) => !IGNORED_LABELS.has(k))
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(',');
}

/**
 * Returns a human-readable display name for a label group.
 * - Single label key: returns just the value (e.g., "10.0.0.1")
 * - Multiple label keys: returns full format (e.g., '{env="prod", host="a"}')
 * - No labels: returns empty string
 */
export function getLabelGroupDisplayName(labels: Record<string, string> | undefined): string {
  if (!labels) {
    return '';
  }
  const filtered = Object.keys(labels)
    .filter((k) => !IGNORED_LABELS.has(k))
    .sort();
  if (filtered.length === 0) {
    return '';
  }
  if (filtered.length === 1) {
    return labels[filtered[0]];
  }
  return `{${filtered.map((k) => `${k}="${labels[k]}"`).join(', ')}}`;
}

/**
 * Groups histogram frames by their non-vmrange labels.
 * Returns a Map where key is a label group string and value is an array of frames belonging to that group.
 */
export function groupFramesByLabels(frames: DataFrame[]): Map<string, DataFrame[]> {
  const groups = new Map<string, DataFrame[]>();
  for (const frame of frames) {
    const valueField = frame.fields.find((f) => f.type === FieldType.number);
    const key = getLabelGroupKey(valueField?.labels);
    const group = groups.get(key);
    if (group) {
      group.push(frame);
    } else {
      groups.set(key, [frame]);
    }
  }
  return groups;
}

/**
 * Parses a single histogram frame into a ParsedBucket.
 * Returns null if the frame is invalid (missing fields, invalid vmrange, etc.).
 */
export function parseBucketFromFrame(frame: DataFrame): ParsedBucket | null {
  const timeField = frame.fields.find((f) => f.type === FieldType.time);
  const valueField = frame.fields.find((f) => f.type === FieldType.number);
  if (!timeField || !valueField) {
    return null;
  }
  const vmrange = valueField.labels?.vmrange;
  if (!vmrange) {
    return null;
  }
  const [minStr, maxStr] = vmrange.split('...');
  const yMin = parseFloat(minStr);
  const yMax = parseFloat(maxStr);
  if (isNaN(yMin) || isNaN(yMax)) {
    return null;
  }
  return {
    yMin,
    yMax,
    timestamps: timeField.values as number[],
    values: valueField.values as Array<number | null>,
  };
}

/**
 * Returns the vmrange label value from a frame's number field.
 */
export function getVmrangeFromFrame(frame: DataFrame): string | undefined {
  return frame.fields.find((f) => f.type === FieldType.number)?.labels?.vmrange;
}

/**
 * Sums all non-null values in an array.
 */
export function sumValues(values: Array<number | null>): number {
  let sum = 0;
  for (const val of values) {
    if (val != null) {
      sum += val;
    }
  }
  return sum;
}

export interface AggregatedBucketData {
  /** Buckets sorted by yMin, with vmrange key and parsed boundaries */
  sortedBuckets: Array<{ vmrange: string; yMin: number; yMax: number }>;
  /** Map from series display name to (vmrange → summed count) */
  groupData: Map<string, Map<string, number>>;
}

/**
 * Aggregates histogram frames into bucket data grouped by labels.
 *
 * Common logic shared by barChart and histogram processors:
 * 1. Groups frames by non-vmrange labels
 * 2. Parses each frame into a bucket, summing values across all timestamps
 * 3. Determines series display names based on label group count
 * 4. Collects and sorts all unique bucket ranges by yMin
 *
 * Returns null if no valid data is found.
 */
export function aggregateBucketData(frames: DataFrame[]): AggregatedBucketData | null {
  const groups = groupFramesByLabels(frames);

  const allBucketRanges = new Map<string, { yMin: number; yMax: number }>();
  const groupData = new Map<string, Map<string, number>>();

  for (const [groupKey, groupFrames] of groups.entries()) {
    const bucketSums = new Map<string, number>();
    const displayName = getLabelGroupDisplayName(
      groupFrames[0]?.fields.find((f) => f.type === FieldType.number)?.labels
    );

    for (const frame of groupFrames) {
      const bucket = parseBucketFromFrame(frame);
      if (!bucket) {
        continue;
      }
      const vmrange = getVmrangeFromFrame(frame);
      if (!vmrange) {
        continue;
      }

      allBucketRanges.set(vmrange, { yMin: bucket.yMin, yMax: bucket.yMax });

      const sum = (bucketSums.get(vmrange) ?? 0) + sumValues(bucket.values);
      bucketSums.set(vmrange, sum);
    }

    const key = groups.size === 1 ? 'count' : displayName || groupKey || 'count';
    groupData.set(key, bucketSums);
  }

  const sortedBuckets = [...allBucketRanges.entries()]
    .sort(([, a], [, b]) => a.yMin - b.yMin)
    .map(([vmrange, { yMin, yMax }]) => ({ vmrange, yMin, yMax }));

  if (sortedBuckets.length === 0) {
    return null;
  }

  return { sortedBuckets, groupData };
}
