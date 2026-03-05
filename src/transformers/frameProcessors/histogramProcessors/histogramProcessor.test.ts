import { DataFrame, DataFrameType, FieldType } from '@grafana/data';

import { processHistogramToNativeHistogram } from './histogramProcessor';

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

describe('processHistogramToNativeHistogram', () => {
  it('should return an empty array when given empty input', () => {
    const result = processHistogramToNativeHistogram([]);
    expect(result).toHaveLength(0);
  });

  it('should produce a frame with DataFrameType.Histogram meta type', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...50' });
    const result = processHistogramToNativeHistogram([frame]);

    expect(result).toHaveLength(1);
    expect(result[0].meta?.type).toBe(DataFrameType.Histogram);
  });

  it('should have numeric xMin and xMax fields', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100' });

    const result = processHistogramToNativeHistogram([frame1, frame2]);

    expect(result[0].fields[0]).toMatchObject({
      name: 'xMin',
      type: FieldType.number,
      values: [0, 50],
    });
    expect(result[0].fields[1]).toMatchObject({
      name: 'xMax',
      type: FieldType.number,
      values: [50, 100],
    });
  });

  it('should name the count field "count" when there is only one label group', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...50' });
    const result = processHistogramToNativeHistogram([frame]);

    expect(result[0].fields).toHaveLength(3);
    expect(result[0].fields[2].name).toBe('count');
    expect(result[0].fields[2].values).toEqual([10]);
  });

  it('should sort buckets by xMin', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '100...200' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50' });
    const frame3 = makeFrame([1000], [30], { vmrange: '50...100' });

    const result = processHistogramToNativeHistogram([frame1, frame2, frame3]);

    expect(result[0].fields[0].values).toEqual([0, 50, 100]);
    expect(result[0].fields[1].values).toEqual([50, 100, 200]);
    expect(result[0].fields[2].values).toEqual([20, 30, 10]);
  });

  it('should sum values across timestamps', () => {
    const frame = makeFrame([1000, 2000, 3000], [10, 20, 30], { vmrange: '0...50' });
    const result = processHistogramToNativeHistogram([frame]);

    expect(result[0].fields[2].values).toEqual([60]);
  });

  it('should handle null values when summing (treat as 0)', () => {
    const frame = makeFrame([1000, 2000, 3000], [10, null, 30], { vmrange: '0...50' });
    const result = processHistogramToNativeHistogram([frame]);

    expect(result[0].fields[2].values).toEqual([40]);
  });

  it('should create separate count fields per label group', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', 'k8s.pod.ip': '10.0.0.1' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100', 'k8s.pod.ip': '10.0.0.1' });
    const frame3 = makeFrame([1000], [30], { vmrange: '0...50', 'k8s.pod.ip': '10.0.0.2' });
    const frame4 = makeFrame([1000], [40], { vmrange: '50...100', 'k8s.pod.ip': '10.0.0.2' });

    const result = processHistogramToNativeHistogram([frame1, frame2, frame3, frame4]);

    expect(result).toHaveLength(1);
    const frame = result[0];

    expect(frame.fields).toHaveLength(4);
    expect(frame.fields[0].values).toEqual([0, 50]);
    expect(frame.fields[1].values).toEqual([50, 100]);

    expect(frame.fields[2].name).toBe('10.0.0.1');
    expect(frame.fields[3].name).toBe('10.0.0.2');

    expect(frame.fields[2].values).toEqual([10, 20]);
    expect(frame.fields[3].values).toEqual([30, 40]);
  });

  it('should fill 0 for buckets missing in a label group', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', host: 'a' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100', host: 'b' });

    const result = processHistogramToNativeHistogram([frame1, frame2]);

    expect(result[0].fields[0].values).toEqual([0, 50]);
    expect(result[0].fields[1].values).toEqual([50, 100]);
    expect(result[0].fields[2].name).toBe('a');
    expect(result[0].fields[3].name).toBe('b');
    expect(result[0].fields[2].values).toEqual([10, 0]);
    expect(result[0].fields[3].values).toEqual([0, 20]);
  });

  it('should sum across timestamps per bucket per label group', () => {
    const frame1 = makeFrame([1000, 2000], [10, 20], { vmrange: '0...50', host: 'a' });
    const frame2 = makeFrame([1000, 2000], [5, 15], { vmrange: '0...50', host: 'b' });

    const result = processHistogramToNativeHistogram([frame1, frame2]);

    expect(result[0].fields[0].values).toEqual([0]);
    expect(result[0].fields[1].values).toEqual([50]);
    expect(result[0].fields[2].name).toBe('a');
    expect(result[0].fields[3].name).toBe('b');
    expect(result[0].fields[2].values).toEqual([30]);
    expect(result[0].fields[3].values).toEqual([20]);
  });

  it('should use full label format for series names when multiple label keys exist', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', env: 'prod', host: 'a' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50', env: 'staging', host: 'b' });

    const result = processHistogramToNativeHistogram([frame1, frame2]);

    expect(result[0].fields).toHaveLength(4);
    expect(result[0].fields[2].name).toBe('{env="prod", host="a"}');
    expect(result[0].fields[3].name).toBe('{env="staging", host="b"}');
  });

  it('should use only label value for series names when single label key exists', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', host: 'server-1' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50', host: 'server-2' });

    const result = processHistogramToNativeHistogram([frame1, frame2]);

    expect(result[0].fields[2].name).toBe('server-1');
    expect(result[0].fields[3].name).toBe('server-2');
  });

  it('should skip invalid frames', () => {
    const validFrame = makeFrame([1000], [10], { vmrange: '0...50' });
    const invalidFrame = makeFrame([1000], [5], { vmrange: 'abc...def' });

    const result = processHistogramToNativeHistogram([validFrame, invalidFrame]);

    expect(result[0].fields[0].values).toEqual([0]);
    expect(result[0].fields[1].values).toEqual([50]);
    expect(result[0].fields[2].values).toEqual([10]);
  });

  it('should handle vmrange with scientific notation as numeric values', () => {
    const frame1 = makeFrame([1000], [258], { vmrange: '1.000e+06...1.136e+06' });
    const frame2 = makeFrame([1000], [120], { vmrange: '1.136e+06...1.292e+06' });

    const result = processHistogramToNativeHistogram([frame1, frame2]);

    expect(result[0].fields[0].values).toEqual([1000000, 1136000]);
    expect(result[0].fields[1].values).toEqual([1136000, 1292000]);
    expect(result[0].fields[2].values).toEqual([258, 120]);
  });

  it('should handle vmrange with negative boundaries', () => {
    const frame = makeFrame([1000], [8], { vmrange: '-100...-50' });
    const result = processHistogramToNativeHistogram([frame]);

    expect(result[0].fields[0].values).toEqual([-100]);
    expect(result[0].fields[1].values).toEqual([-50]);
    expect(result[0].fields[2].values).toEqual([8]);
  });

  it('should handle vmrange with floating point boundaries', () => {
    const frame = makeFrame([1000], [3], { vmrange: '1.5...2.7' });
    const result = processHistogramToNativeHistogram([frame]);

    expect(result[0].fields[0].values).toEqual([1.5]);
    expect(result[0].fields[1].values).toEqual([2.7]);
  });

  it('should set correct length on result frame', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100' });
    const frame3 = makeFrame([1000], [30], { vmrange: '100...150' });

    const result = processHistogramToNativeHistogram([frame1, frame2, frame3]);

    expect(result[0].length).toBe(3);
  });
});
