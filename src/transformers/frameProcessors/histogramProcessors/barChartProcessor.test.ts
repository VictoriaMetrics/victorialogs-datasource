import { DataFrame, FieldType } from '@grafana/data';

import { processHistogramToBarChart } from './barChartProcessor';

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

describe('processHistogramToBarChart', () => {
  it('should return an empty array when given empty input', () => {
    const result = processHistogramToBarChart([]);
    expect(result).toHaveLength(0);
  });

  it('should produce a wide-format frame with Bucket string field', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100' });

    const result = processHistogramToBarChart([frame1, frame2]);

    expect(result).toHaveLength(1);
    expect(result[0].fields[0].name).toBe('Bucket');
    expect(result[0].fields[0].type).toBe(FieldType.string);
    expect(result[0].fields[0].values).toEqual(['0 - 50', '50 - 100']);
  });

  it('should name the value field "count" when there is only one label group', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...50' });
    const result = processHistogramToBarChart([frame]);

    expect(result[0].fields).toHaveLength(2);
    expect(result[0].fields[1].name).toBe('count');
    expect(result[0].fields[1].values).toEqual([10]);
  });

  it('should sort buckets by yMin', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '100...200' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50' });
    const frame3 = makeFrame([1000], [30], { vmrange: '50...100' });

    const result = processHistogramToBarChart([frame1, frame2, frame3]);

    expect(result[0].fields[0].values).toEqual(['0 - 50', '50 - 100', '100 - 200']);
    expect(result[0].fields[1].values).toEqual([20, 30, 10]);
  });

  it('should sum values across timestamps', () => {
    const frame = makeFrame([1000, 2000, 3000], [10, 20, 30], { vmrange: '0...50' });
    const result = processHistogramToBarChart([frame]);

    expect(result[0].fields[1].values).toEqual([60]);
  });

  it('should handle null values when summing (treat as 0)', () => {
    const frame = makeFrame([1000, 2000, 3000], [10, null, 30], { vmrange: '0...50' });
    const result = processHistogramToBarChart([frame]);

    expect(result[0].fields[1].values).toEqual([40]);
  });

  it('should create separate number fields per label group', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', 'k8s.pod.ip': '10.0.0.1' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100', 'k8s.pod.ip': '10.0.0.1' });
    const frame3 = makeFrame([1000], [30], { vmrange: '0...50', 'k8s.pod.ip': '10.0.0.2' });
    const frame4 = makeFrame([1000], [40], { vmrange: '50...100', 'k8s.pod.ip': '10.0.0.2' });

    const result = processHistogramToBarChart([frame1, frame2, frame3, frame4]);

    expect(result).toHaveLength(1);
    const frame = result[0];

    expect(frame.fields).toHaveLength(3);
    expect(frame.fields[0].name).toBe('Bucket');
    expect(frame.fields[0].values).toEqual(['0 - 50', '50 - 100']);

    expect(frame.fields[1].name).toBe('10.0.0.1');
    expect(frame.fields[2].name).toBe('10.0.0.2');

    expect(frame.fields[1].values).toEqual([10, 20]);
    expect(frame.fields[2].values).toEqual([30, 40]);
  });

  it('should fill 0 for buckets missing in a label group', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', host: 'a' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100', host: 'b' });

    const result = processHistogramToBarChart([frame1, frame2]);

    expect(result[0].fields[0].values).toEqual(['0 - 50', '50 - 100']);
    expect(result[0].fields[1].name).toBe('a');
    expect(result[0].fields[2].name).toBe('b');
    expect(result[0].fields[1].values).toEqual([10, 0]);
    expect(result[0].fields[2].values).toEqual([0, 20]);
  });

  it('should sum across timestamps per bucket per label group', () => {
    const frame1 = makeFrame([1000, 2000], [10, 20], { vmrange: '0...50', host: 'a' });
    const frame2 = makeFrame([1000, 2000], [5, 15], { vmrange: '0...50', host: 'b' });

    const result = processHistogramToBarChart([frame1, frame2]);

    expect(result[0].fields[0].values).toEqual(['0 - 50']);
    expect(result[0].fields[1].name).toBe('a');
    expect(result[0].fields[2].name).toBe('b');
    expect(result[0].fields[1].values).toEqual([30]);
    expect(result[0].fields[2].values).toEqual([20]);
  });

  it('should skip invalid frames', () => {
    const validFrame = makeFrame([1000], [10], { vmrange: '0...50' });
    const invalidFrame = makeFrame([1000], [5], { vmrange: 'abc...def' });

    const result = processHistogramToBarChart([validFrame, invalidFrame]);

    expect(result[0].fields[0].values).toEqual(['0 - 50']);
    expect(result[0].fields[1].values).toEqual([10]);
  });

  it('should handle vmrange with negative boundaries', () => {
    const frame = makeFrame([1000], [8], { vmrange: '-100...-50' });
    const result = processHistogramToBarChart([frame]);

    expect(result[0].fields[0].values).toEqual(['-100 - -50']);
    expect(result[0].fields[1].values).toEqual([8]);
  });

  it('should set correct length on result frame', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100' });
    const frame3 = makeFrame([1000], [30], { vmrange: '100...150' });

    const result = processHistogramToBarChart([frame1, frame2, frame3]);

    expect(result[0].length).toBe(3);
  });

  it('should use full label format for series names when multiple label keys exist', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', env: 'prod', host: 'a' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50', env: 'staging', host: 'b' });

    const result = processHistogramToBarChart([frame1, frame2]);

    expect(result[0].fields).toHaveLength(3);
    expect(result[0].fields[1].name).toBe('{env="prod", host="a"}');
    expect(result[0].fields[2].name).toBe('{env="staging", host="b"}');
  });

  it('should use only label value for series names when single label key exists', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', host: 'server-1' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50', host: 'server-2' });

    const result = processHistogramToBarChart([frame1, frame2]);

    expect(result[0].fields[1].name).toBe('server-1');
    expect(result[0].fields[2].name).toBe('server-2');
  });

  it('should format scientific notation vmrange into readable numbers', () => {
    const frame1 = makeFrame([1000], [258], { vmrange: '1.000e+06...1.136e+06' });
    const frame2 = makeFrame([1000], [120], { vmrange: '1.136e+06...1.292e+06' });

    const result = processHistogramToBarChart([frame1, frame2]);

    expect(result[0].fields[0].values).toEqual(['1000000 - 1136000', '1136000 - 1292000']);
  });

  it('should format small decimal vmrange correctly', () => {
    const frame = makeFrame([1000], [5], { vmrange: '1.500e-02...2.700e-02' });
    const result = processHistogramToBarChart([frame]);

    expect(result[0].fields[0].values).toEqual(['0.015 - 0.027']);
  });
});
