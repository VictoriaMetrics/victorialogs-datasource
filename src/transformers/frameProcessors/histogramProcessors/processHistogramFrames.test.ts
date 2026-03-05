import { DataFrame, DataFrameType, FieldType } from '@grafana/data';

import { processHistogramFrames } from './processHistogramFrames';

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
  it('should return the original frames by default (no panelPluginId)', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...100' });
    const frames = [frame];
    const result = processHistogramFrames(frames);
    expect(result).toHaveLength(1);
    expect(result).toBe(frames);
  });

  it('should delegate to heatmap for heatmap panel', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...100' });
    const result = processHistogramFrames([frame], 'heatmap');
    expect(result).toHaveLength(1);
    expect(result[0].meta?.type).toBe(DataFrameType.HeatmapCells);
  });

  it('should delegate to bar chart for barchart panel', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...100' });
    const result = processHistogramFrames([frame], 'barchart');
    expect(result).toHaveLength(1);
    expect(result[0].fields[0].type).toBe(FieldType.string);
    expect(result[0].fields[0].name).toBe('Bucket');
  });

  it('should delegate to native histogram for histogram panel', () => {
    const frame = makeFrame([1000], [10], { vmrange: '0...100' });
    const result = processHistogramFrames([frame], 'histogram');
    expect(result).toHaveLength(1);
    expect(result[0].meta?.type).toBe(DataFrameType.Histogram);
    expect(result[0].fields[0].name).toBe('xMin');
    expect(result[0].fields[1].name).toBe('xMax');
  });

  it('should return empty array for empty input regardless of panelPluginId', () => {
    expect(processHistogramFrames([])).toHaveLength(0);
    expect(processHistogramFrames([], 'barchart')).toHaveLength(0);
    expect(processHistogramFrames([], 'heatmap')).toHaveLength(0);
    expect(processHistogramFrames([], 'histogram')).toHaveLength(0);
  });
});
