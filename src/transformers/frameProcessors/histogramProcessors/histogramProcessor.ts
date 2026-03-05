import { DataFrame, DataFrameType, FieldType } from '@grafana/data';

import { aggregateBucketData } from './utils';

/**
 * Processes histogram frames into Grafana's native Histogram format (DataFrameType.Histogram).
 *
 * Output format:
 * - Number field "xMin" with lower bucket boundaries
 * - Number field "xMax" with upper bucket boundaries
 * - One or more number fields for counts (one per label group), with values summed across all timestamps
 *
 * When there is only one label group, the count field is named "count".
 */
export function processHistogramToNativeHistogram(frames: DataFrame[]): DataFrame[] {
  if (frames.length === 0) {
    return [];
  }

  const aggregated = aggregateBucketData(frames);
  if (!aggregated) {
    return [];
  }

  const { sortedBuckets, groupData } = aggregated;

  const xMinValues: number[] = sortedBuckets.map(({ yMin }) => yMin);
  const xMaxValues: number[] = sortedBuckets.map(({ yMax }) => yMax);

  const fields: DataFrame['fields'] = [
    {
      name: 'xMin',
      type: FieldType.number,
      config: {},
      values: xMinValues,
    },
    {
      name: 'xMax',
      type: FieldType.number,
      config: {},
      values: xMaxValues,
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
      meta: {
        type: DataFrameType.Histogram,
      },
      fields,
    },
  ];
}
