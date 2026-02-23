import { DataFrame, DataFrameType, FieldType } from '@grafana/data';

import { processHistogramFrames } from './histogramFrameProcessor';

const makeFrame = (
  timeValues: number[],
  numberValues: Array<number | null>,
  labels?: Record<string, string>
): DataFrame => ({
  length: timeValues.length,
  fields: [
    { name: 'Time', type: FieldType.time, config: {}, values: timeValues },
    { name: 'Value', type: FieldType.number, config: {}, values: numberValues, labels },
  ],
});

describe('processHistogramFrames', () => {
  it('should return a single frame with empty arrays when given an empty input', () => {
    const result = processHistogramFrames([]);
    expect(result).toHaveLength(0);
  });

  it('should skip frames without a time field', () => {
    const frame: DataFrame = {
      length: 1,
      fields: [{ name: 'Value', type: FieldType.number, config: {}, values: [5], labels: { vmrange: '1...2' } }],
    };
    const result = processHistogramFrames([frame]);
    expect(result[0].length).toBe(0);
    expect(result[0].fields[3].values).toEqual([]);
  });

  it('should skip frames without a number field', () => {
    const frame: DataFrame = {
      length: 1,
      fields: [{ name: 'Time', type: FieldType.time, config: {}, values: [1000] }],
    };
    const result = processHistogramFrames([frame]);
    expect(result[0].length).toBe(0);
  });

  it('should skip frames without vmrange label', () => {
    const frame = makeFrame([1000], [5], { someLabel: 'value' });
    const result = processHistogramFrames([frame]);
    expect(result[0].length).toBe(0);
  });

  it('should skip frames with vmrange label that is empty', () => {
    const frame = makeFrame([1000], [5], { vmrange: '' });
    const result = processHistogramFrames([frame]);
    expect(result[0].length).toBe(0);
  });

  it('should skip frames with unparseable vmrange (NaN values)', () => {
    const frame = makeFrame([1000], [5], { vmrange: 'abc...def' });
    const result = processHistogramFrames([frame]);
    expect(result[0].length).toBe(0);
  });

  it('should skip frames where only yMin is NaN', () => {
    const frame = makeFrame([1000], [5], { vmrange: 'abc...2' });
    const result = processHistogramFrames([frame]);
    expect(result[0].length).toBe(0);
  });

  it('should skip frames where only yMax is NaN', () => {
    const frame = makeFrame([1000], [5], { vmrange: '1...abc' });
    const result = processHistogramFrames([frame]);
    expect(result[0].length).toBe(0);
  });

  it('should process a single valid frame with one bucket and one timestamp', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...100' });
    const result = processHistogramFrames([frame]);

    expect(result).toHaveLength(1);
    expect(result[0].meta?.type).toBe(DataFrameType.HeatmapCells);
    expect(result[0].length).toBe(1);
    expect(result[0].fields[0]).toMatchObject({
      name: 'xMax',
      type: FieldType.time,
      values: [1000],
    });
    expect(result[0].fields[1]).toMatchObject({
      name: 'yMin',
      type: FieldType.number,
      values: [0],
    });
    expect(result[0].fields[2]).toMatchObject({
      name: 'yMax',
      type: FieldType.number,
      values: [100],
    });
    expect(result[0].fields[3]).toMatchObject({
      name: 'count',
      type: FieldType.number,
      values: [10],
    });
  });

  it('should use default intervalMs of 60000 when there is only one timestamp', () => {
    const frame = makeFrame([5000], [3], { vmrange: '1...2' });
    const result = processHistogramFrames([frame]);
    expect(result[0].fields[0].config.interval).toBe(60000);
  });

  it('should calculate intervalMs from first two sorted timestamps', () => {
    const frame1 = makeFrame([1000, 3000], [1, 2], { vmrange: '0...10' });
    const result = processHistogramFrames([frame1]);
    expect(result[0].fields[0].config.interval).toBe(2000);
  });

  it('should sort buckets by yMin', () => {
    const frame1 = makeFrame([1000], [5], { vmrange: '100...200' });
    const frame2 = makeFrame([1000], [3], { vmrange: '0...50' });
    const frame3 = makeFrame([1000], [7], { vmrange: '50...100' });

    const result = processHistogramFrames([frame1, frame2, frame3]);

    // For the single timestamp, we should have 3 entries (one per bucket), sorted by yMin
    expect(result[0].length).toBe(3);
    expect(result[0].fields[1].values).toEqual([0, 50, 100]); // yMin sorted
    expect(result[0].fields[2].values).toEqual([50, 100, 200]); // yMax corresponding
    expect(result[0].fields[3].values).toEqual([3, 7, 5]); // count corresponding
  });

  it('should handle multiple buckets with multiple timestamps', () => {
    const frame1 = makeFrame([1000, 2000], [10, 20], { vmrange: '0...50' });
    const frame2 = makeFrame([1000, 2000], [30, 40], { vmrange: '50...100' });

    const result = processHistogramFrames([frame1, frame2]);

    // 2 timestamps x 2 buckets = 4 entries
    expect(result[0].length).toBe(4);
    // For timestamp 1000: bucket 0...50, then bucket 50...100
    // For timestamp 2000: bucket 0...50, then bucket 50...100
    expect(result[0].fields[0].values).toEqual([1000, 1000, 2000, 2000]); // xMax
    expect(result[0].fields[1].values).toEqual([0, 50, 0, 50]); // yMin
    expect(result[0].fields[2].values).toEqual([50, 100, 50, 100]); // yMax
    expect(result[0].fields[3].values).toEqual([10, 30, 20, 40]); // count
    expect(result[0].fields[0].config.interval).toBe(1000);
  });

  it('should fill count with 0 when a bucket does not have a value for a given timestamp', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50' });
    const frame2 = makeFrame([2000], [20], { vmrange: '50...100' });

    const result = processHistogramFrames([frame1, frame2]);

    // 2 timestamps x 2 buckets = 4 entries
    expect(result[0].length).toBe(4);
    expect(result[0].fields[0].values).toEqual([1000, 1000, 2000, 2000]);
    expect(result[0].fields[1].values).toEqual([0, 50, 0, 50]);
    expect(result[0].fields[2].values).toEqual([50, 100, 50, 100]);
    // frame1 has ts=1000 but not 2000; frame2 has ts=2000 but not 1000
    expect(result[0].fields[3].values).toEqual([10, 0, 0, 20]);
  });

  it('should merge timestamps from different buckets and sort them', () => {
    const frame1 = makeFrame([3000, 1000], [10, 20], { vmrange: '0...50' });
    const frame2 = makeFrame([2000], [30], { vmrange: '50...100' });

    const result = processHistogramFrames([frame1, frame2]);

    // Unique timestamps: 1000, 2000, 3000 (sorted)
    // 3 timestamps x 2 buckets = 6 entries
    expect(result[0].length).toBe(6);
    expect(result[0].fields[0].values).toEqual([1000, 1000, 2000, 2000, 3000, 3000]);
    expect(result[0].fields[3].values).toEqual([20, 0, 0, 30, 10, 0]);
    expect(result[0].fields[0].config.interval).toBe(1000);
  });

  it('should deduplicate timestamps across buckets', () => {
    const frame1 = makeFrame([1000, 2000], [1, 2], { vmrange: '0...10' });
    const frame2 = makeFrame([1000, 2000], [3, 4], { vmrange: '10...20' });

    const result = processHistogramFrames([frame1, frame2]);

    // Only 2 unique timestamps, not 4
    expect(result[0].length).toBe(4); // 2 timestamps x 2 buckets
    expect(result[0].fields[0].values).toEqual([1000, 1000, 2000, 2000]);
  });

  it('should process a mix of valid and invalid frames', () => {
    const validFrame = makeFrame([1000], [5], { vmrange: '0...10' });
    const noTimeField: DataFrame = {
      length: 1,
      fields: [{ name: 'Value', type: FieldType.number, config: {}, values: [5], labels: { vmrange: '10...20' } }],
    };
    const noVmrange = makeFrame([1000], [3], { otherLabel: 'value' });
    const badVmrange = makeFrame([1000], [7], { vmrange: 'bad...range' });

    const result = processHistogramFrames([validFrame, noTimeField, noVmrange, badVmrange]);

    // Only the first frame is valid
    expect(result[0].length).toBe(1);
    expect(result[0].fields[1].values).toEqual([0]);
    expect(result[0].fields[2].values).toEqual([10]);
    expect(result[0].fields[3].values).toEqual([5]);
  });

  it('should handle null values in the count field', () => {
    const frame = makeFrame([1000, 2000], [null, 5], { vmrange: '0...10' });
    const result = processHistogramFrames([frame]);

    expect(result[0].fields[3].values).toEqual([null, 5]);
  });

  it('should handle vmrange with negative boundaries', () => {
    const frame = makeFrame([1000], [8], { vmrange: '-100...-50' });
    const result = processHistogramFrames([frame]);

    expect(result[0].fields[1].values).toEqual([-100]);
    expect(result[0].fields[2].values).toEqual([-50]);
    expect(result[0].fields[3].values).toEqual([8]);
  });

  it('should handle vmrange with floating point boundaries', () => {
    const frame = makeFrame([1000], [3], { vmrange: '1.5...2.7' });
    const result = processHistogramFrames([frame]);

    expect(result[0].fields[1].values).toEqual([1.5]);
    expect(result[0].fields[2].values).toEqual([2.7]);
  });
});
