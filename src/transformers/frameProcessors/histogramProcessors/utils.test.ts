import { DataFrame, FieldType } from '@grafana/data';

import {
  formatBucketRange,
  getLabelGroupKey,
  getLabelGroupDisplayName,
  groupFramesByLabels,
  parseBucketFromFrame,
  getVmrangeFromFrame,
  sumValues,
  aggregateBucketData,
} from './utils';

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

describe('formatBucketRange', () => {
  it('should format a range with integers', () => {
    expect(formatBucketRange(0, 50)).toBe('0 - 50');
  });

  it('should format a range with floats', () => {
    expect(formatBucketRange(1.5, 2.7)).toBe('1.5 - 2.7');
  });

  it('should format a range with negative numbers', () => {
    expect(formatBucketRange(-100, -50)).toBe('-100 - -50');
  });

  it('should format a range with large numbers', () => {
    expect(formatBucketRange(1000000, 1136000)).toBe('1000000 - 1136000');
  });
});

describe('getLabelGroupKey', () => {
  it('should return empty string for undefined labels', () => {
    expect(getLabelGroupKey(undefined)).toBe('');
  });

  it('should return empty string for empty labels', () => {
    expect(getLabelGroupKey({})).toBe('');
  });

  it('should ignore vmrange label', () => {
    expect(getLabelGroupKey({ vmrange: '0...50' })).toBe('');
  });

  it('should ignore __name__ label', () => {
    expect(getLabelGroupKey({ __name__: 'metric' })).toBe('');
  });

  it('should return key for single label', () => {
    expect(getLabelGroupKey({ host: 'a' })).toBe('host=a');
  });

  it('should sort labels alphabetically', () => {
    expect(getLabelGroupKey({ host: 'a', env: 'prod' })).toBe('env=prod,host=a');
  });

  it('should filter out vmrange and __name__ while keeping other labels', () => {
    expect(getLabelGroupKey({ vmrange: '0...50', __name__: 'metric', host: 'a' })).toBe('host=a');
  });
});

describe('getLabelGroupDisplayName', () => {
  it('should return empty string for undefined labels', () => {
    expect(getLabelGroupDisplayName(undefined)).toBe('');
  });

  it('should return empty string when only ignored labels exist', () => {
    expect(getLabelGroupDisplayName({ vmrange: '0...50', __name__: 'metric' })).toBe('');
  });

  it('should return just the value for single label key', () => {
    expect(getLabelGroupDisplayName({ vmrange: '0...50', host: 'server-1' })).toBe('server-1');
  });

  it('should return full format for multiple label keys', () => {
    expect(getLabelGroupDisplayName({ vmrange: '0...50', env: 'prod', host: 'a' })).toBe('{env="prod", host="a"}');
  });

  it('should sort labels alphabetically in full format', () => {
    expect(getLabelGroupDisplayName({ z: '1', a: '2' })).toBe('{a="2", z="1"}');
  });
});

describe('groupFramesByLabels', () => {
  it('should group frames with same labels together', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', host: 'a' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100', host: 'a' });
    const frame3 = makeFrame([1000], [30], { vmrange: '0...50', host: 'b' });

    const groups = groupFramesByLabels([frame1, frame2, frame3]);

    expect(groups.size).toBe(2);
    expect(groups.get('host=a')).toHaveLength(2);
    expect(groups.get('host=b')).toHaveLength(1);
  });

  it('should treat frames without labels as one group', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100' });

    const groups = groupFramesByLabels([frame1, frame2]);

    expect(groups.size).toBe(1);
    expect(groups.get('')).toHaveLength(2);
  });

  it('should ignore vmrange and __name__ when grouping', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', __name__: 'metric', host: 'a' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100', __name__: 'metric', host: 'a' });

    const groups = groupFramesByLabels([frame1, frame2]);

    expect(groups.size).toBe(1);
    expect(groups.get('host=a')).toHaveLength(2);
  });
});

describe('parseBucketFromFrame', () => {
  it('should parse a valid frame into a ParsedBucket', () => {
    const frame = makeFrame([1000, 2000], [10, 20], { vmrange: '0...50' });
    const bucket = parseBucketFromFrame(frame);

    expect(bucket).toEqual({
      yMin: 0,
      yMax: 50,
      timestamps: [1000, 2000],
      values: [10, 20],
    });
  });

  it('should return null if no time field', () => {
    const frame: DataFrame = {
      length: 1,
      fields: [{ name: 'Value', type: FieldType.number, config: {}, values: [5], labels: { vmrange: '0...50' } }],
    };
    expect(parseBucketFromFrame(frame)).toBeNull();
  });

  it('should return null if no number field', () => {
    const frame: DataFrame = {
      length: 1,
      fields: [{ name: 'Time', type: FieldType.time, config: {}, values: [1000] }],
    };
    expect(parseBucketFromFrame(frame)).toBeNull();
  });

  it('should return null if no vmrange label', () => {
    const frame = makeFrame([1000], [5], { someLabel: 'value' });
    expect(parseBucketFromFrame(frame)).toBeNull();
  });

  it('should return null if vmrange is empty', () => {
    const frame = makeFrame([1000], [5], { vmrange: '' });
    expect(parseBucketFromFrame(frame)).toBeNull();
  });

  it('should return null if vmrange is unparseable', () => {
    expect(parseBucketFromFrame(makeFrame([1000], [5], { vmrange: 'abc...def' }))).toBeNull();
    expect(parseBucketFromFrame(makeFrame([1000], [5], { vmrange: 'abc...2' }))).toBeNull();
    expect(parseBucketFromFrame(makeFrame([1000], [5], { vmrange: '1...abc' }))).toBeNull();
  });

  it('should parse negative boundaries', () => {
    const bucket = parseBucketFromFrame(makeFrame([1000], [8], { vmrange: '-100...-50' }));
    expect(bucket?.yMin).toBe(-100);
    expect(bucket?.yMax).toBe(-50);
  });

  it('should parse floating point boundaries', () => {
    const bucket = parseBucketFromFrame(makeFrame([1000], [3], { vmrange: '1.5...2.7' }));
    expect(bucket?.yMin).toBe(1.5);
    expect(bucket?.yMax).toBe(2.7);
  });

  it('should parse scientific notation boundaries', () => {
    const bucket = parseBucketFromFrame(makeFrame([1000], [5], { vmrange: '1.000e+06...1.136e+06' }));
    expect(bucket?.yMin).toBe(1000000);
    expect(bucket?.yMax).toBe(1136000);
  });
});

describe('getVmrangeFromFrame', () => {
  it('should return vmrange label value', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...50' });
    expect(getVmrangeFromFrame(frame)).toBe('0...50');
  });

  it('should return undefined if no number field', () => {
    const frame: DataFrame = {
      length: 1,
      fields: [{ name: 'Time', type: FieldType.time, config: {}, values: [1000] }],
    };
    expect(getVmrangeFromFrame(frame)).toBeUndefined();
  });

  it('should return undefined if no vmrange label', () => {
    const frame = makeFrame([1000], [10], { host: 'a' });
    expect(getVmrangeFromFrame(frame)).toBeUndefined();
  });
});

describe('sumValues', () => {
  it('should sum all values', () => {
    expect(sumValues([10, 20, 30])).toBe(60);
  });

  it('should skip null values', () => {
    expect(sumValues([10, null, 30])).toBe(40);
  });

  it('should return 0 for empty array', () => {
    expect(sumValues([])).toBe(0);
  });

  it('should return 0 for all nulls', () => {
    expect(sumValues([null, null])).toBe(0);
  });
});

describe('aggregateBucketData', () => {
  it('should return null when all frames are invalid', () => {
    const frame = makeFrame([1000], [5], { vmrange: 'abc...def' });
    expect(aggregateBucketData([frame])).toBeNull();
  });

  it('should aggregate a single valid frame', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...50' });
    const result = aggregateBucketData([frame]);

    expect(result).not.toBeNull();
    expect(result!.sortedBuckets).toEqual([{ vmrange: '0...50', yMin: 0, yMax: 50 }]);
    expect(result!.groupData.size).toBe(1);
    expect(result!.groupData.get('count')?.get('0...50')).toBe(10);
  });

  it('should sort buckets by yMin', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '100...200' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50' });
    const frame3 = makeFrame([1000], [30], { vmrange: '50...100' });

    const result = aggregateBucketData([frame1, frame2, frame3]);

    expect(result!.sortedBuckets.map((b) => b.yMin)).toEqual([0, 50, 100]);
  });

  it('should sum values across timestamps', () => {
    const frame = makeFrame([1000, 2000, 3000], [10, 20, 30], { vmrange: '0...50' });
    const result = aggregateBucketData([frame]);

    expect(result!.groupData.get('count')?.get('0...50')).toBe(60);
  });

  it('should handle null values when summing', () => {
    const frame = makeFrame([1000, 2000], [10, null], { vmrange: '0...50' });
    const result = aggregateBucketData([frame]);

    expect(result!.groupData.get('count')?.get('0...50')).toBe(10);
  });

  it('should name series "count" when only one label group', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...50' });
    const result = aggregateBucketData([frame]);

    expect(result!.groupData.has('count')).toBe(true);
  });

  it('should use label value for series name with single label key', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', host: 'server-1' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50', host: 'server-2' });

    const result = aggregateBucketData([frame1, frame2]);

    expect(result!.groupData.has('server-1')).toBe(true);
    expect(result!.groupData.has('server-2')).toBe(true);
  });

  it('should use full label format for series name with multiple label keys', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', env: 'prod', host: 'a' });
    const frame2 = makeFrame([1000], [20], { vmrange: '0...50', env: 'staging', host: 'b' });

    const result = aggregateBucketData([frame1, frame2]);

    expect(result!.groupData.has('{env="prod", host="a"}')).toBe(true);
    expect(result!.groupData.has('{env="staging", host="b"}')).toBe(true);
  });

  it('should collect bucket ranges from all groups', () => {
    const frame1 = makeFrame([1000], [10], { vmrange: '0...50', host: 'a' });
    const frame2 = makeFrame([1000], [20], { vmrange: '50...100', host: 'b' });

    const result = aggregateBucketData([frame1, frame2]);

    expect(result!.sortedBuckets).toHaveLength(2);
    expect(result!.sortedBuckets.map((b) => b.vmrange)).toEqual(['0...50', '50...100']);
  });

  it('should skip invalid frames and process valid ones', () => {
    const valid = makeFrame([1000], [10], { vmrange: '0...50' });
    const invalid = makeFrame([1000], [5], { vmrange: 'abc...def' });

    const result = aggregateBucketData([valid, invalid]);

    expect(result!.sortedBuckets).toHaveLength(1);
    expect(result!.groupData.get('count')?.get('0...50')).toBe(10);
  });
});
