import { DataFrame, FieldType } from '@grafana/data';

import { aggregateBucketData, formatBucketRange } from './utils';

/**
 * Processes histogram frames into a wide-format DataFrame suitable for Grafana Bar Chart panel.
 *
 * Output format:
 * - String field "Bucket" for X axis (e.g., "0 - 50", "50 - 100")
 * - One number field per label group, with values summed across all timestamps
 *
 * When there is only one label group, the field is named "count".
 */
export function processHistogramToBarChart(frames: DataFrame[]): DataFrame[] {
  if (frames.length === 0) {
    return [];
  }

  const aggregated = aggregateBucketData(frames);
  if (!aggregated) {
    return [];
  }

  const { sortedBuckets, groupData } = aggregated;

  const bucketValues: string[] = sortedBuckets.map(({ yMin, yMax }) => formatBucketRange(yMin, yMax));
  const fields: DataFrame['fields'] = [
    {
      name: 'Bucket',
      type: FieldType.string,
      config: {},
      values: bucketValues,
    },
  ];

  for (const [seriesName, bucketSums] of groupData.entries()) {
    const values: number[] = sortedBuckets.map(({ vmrange }) => bucketSums.get(vmrange) ?? 0);
    fields.push({
      name: seriesName,
      type: FieldType.number,
      config: {},
      values,
    });
  }

  return [
    {
      length: sortedBuckets.length,
      fields,
    },
  ];
}
