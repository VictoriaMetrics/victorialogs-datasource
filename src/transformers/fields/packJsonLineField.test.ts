import { DataFrame, FieldType } from '@grafana/data';

import { Query, QueryType, SupportingQueryType } from '../../types';

import { packLabelsToLine, shouldPackLabelsToLine } from './packJsonLineField';

const buildFrame = (lines: string[], labels: object[]): DataFrame => ({
  refId: 'A',
  length: lines.length,
  fields: [
    { name: 'Time', type: FieldType.time, config: {}, values: lines.map((_, i) => i) },
    { name: 'Line', type: FieldType.string, config: {}, values: lines },
    { name: 'labels', type: FieldType.other, config: {}, values: labels },
  ],
});

const getFieldValues = (frame: DataFrame, name: string) =>
  frame.fields.find((f) => f.name === name)?.values;

describe('packLabelsToLine', () => {
  it('replaces the line with a JSON object of all labels when the message is empty', () => {
    const frame = buildFrame([''], [{ app: 'nginx', level: 'info' }]);

    const packed = packLabelsToLine(frame);

    expect(getFieldValues(packed, 'Line')?.[0]).toBe('{"app":"nginx","level":"info"}');
  });

  it('keeps the original message in the JSON under the _msg key', () => {
    const frame = buildFrame(['hello world'], [{ app: 'nginx' }]);

    const packed = packLabelsToLine(frame);

    expect(getFieldValues(packed, 'Line')?.[0]).toBe('{"_msg":"hello world","app":"nginx"}');
  });

  it('keeps a row untouched when it has no labels and no message', () => {
    const frame = buildFrame([''], [{}]);

    const packed = packLabelsToLine(frame);

    expect(getFieldValues(packed, 'Line')?.[0]).toBe('');
  });

  it('packs a message-only row into JSON with the single _msg key', () => {
    const frame = buildFrame(['hello'], [{}]);

    const packed = packLabelsToLine(frame);

    expect(getFieldValues(packed, 'Line')?.[0]).toBe('{"_msg":"hello"}');
  });

  it('handles a missing labels value for a row', () => {
    const frame = buildFrame([''], [null as unknown as object]);

    const packed = packLabelsToLine(frame);

    expect(getFieldValues(packed, 'Line')?.[0]).toBe('');
  });

  it('does not modify the labels field', () => {
    const labels = [{ app: 'nginx' }];
    const frame = buildFrame([''], labels);

    const packed = packLabelsToLine(frame);

    expect(getFieldValues(packed, 'labels')?.[0]).toEqual({ app: 'nginx' });
  });

  it('does not mutate the original frame', () => {
    const frame = buildFrame([''], [{ app: 'nginx' }]);

    packLabelsToLine(frame);

    expect(getFieldValues(frame, 'Line')?.[0]).toBe('');
  });

  it('returns the frame untouched when the Line field is missing', () => {
    const frame: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [{ name: 'labels', type: FieldType.other, config: {}, values: [{ app: 'nginx' }] }],
    };

    expect(packLabelsToLine(frame)).toBe(frame);
  });

  it('returns the frame untouched when the labels field is missing', () => {
    const frame: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [{ name: 'Line', type: FieldType.string, config: {}, values: ['msg'] }],
    };

    expect(packLabelsToLine(frame)).toBe(frame);
  });
});

describe('shouldPackLabelsToLine', () => {
  const baseQuery = { refId: 'A', expr: '*', queryType: QueryType.Instant, packJson: true } as Query;

  it('returns true for a raw logs query with the packJson option enabled', () => {
    expect(shouldPackLabelsToLine(baseQuery)).toBe(true);
  });

  it('returns false when the packJson option is disabled', () => {
    expect(shouldPackLabelsToLine({ ...baseQuery, packJson: false })).toBe(false);
  });

  it('returns false when the packJson option is undefined', () => {
    expect(shouldPackLabelsToLine({ ...baseQuery, packJson: undefined })).toBe(false);
  });

  it.each([QueryType.Stats, QueryType.StatsRange, QueryType.Hits])(
    'returns false for the %s query type',
    (queryType) => {
      expect(shouldPackLabelsToLine({ ...baseQuery, queryType })).toBe(false);
    }
  );

  it('returns false for supporting queries (logs sample)', () => {
    expect(
      shouldPackLabelsToLine({ ...baseQuery, supportingQueryType: SupportingQueryType.LogsSample })
    ).toBe(false);
  });

  it('returns false when the query is undefined', () => {
    expect(shouldPackLabelsToLine(undefined)).toBe(false);
  });
});
