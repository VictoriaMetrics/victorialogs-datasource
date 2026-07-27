import { DataFrame, FieldType } from '@grafana/data';

import { Query, QueryType, SupportingQueryType } from '../../types';

import { processStreamsFrames } from './streamFrameProcessor';

const buildFrame = (labels: Array<Record<string, string>>, streams?: Array<Record<string, string> | null>): DataFrame => ({
  refId: 'A',
  length: labels.length,
  fields: [
    { name: 'Time', type: FieldType.time, config: {}, values: labels.map((_, i) => i) },
    { name: 'Line', type: FieldType.string, config: {}, values: labels.map(() => 'msg') },
    { name: 'labels', type: FieldType.other, config: {}, values: labels },
    ...(streams
      ? [
        { name: 'streams', type: FieldType.other, config: { custom: { hidden: true } }, values: streams },
        {
          name: 'streamId',
          type: FieldType.string,
          config: { custom: { hidden: true } },
          values: labels.map((l) => l._stream_id ?? ''),
        },
      ]
      : []),
  ],
});

describe('processStreamsFrames', () => {
  const queryMap = new Map<string, Query>([['A', { refId: 'A', expr: '*' }]]);

  it('passes the hidden streams/streamId fields through untouched', () => {
    const streams = [{ app: 'nginx' }, { app: 'apache' }];
    const frame = buildFrame(
      [
        { _stream_id: 'id-1', app: 'nginx' },
        { _stream_id: 'id-2', app: 'apache' },
      ],
      streams
    );

    const [processed] = processStreamsFrames([frame], queryMap, [], []);

    const streamsField = processed.fields.find((f) => f.name === 'streams');
    const streamIdField = processed.fields.find((f) => f.name === 'streamId');
    expect(streamsField?.values).toEqual(streams);
    expect(streamsField?.config.custom?.hidden).toBe(true);
    expect(streamIdField?.values).toEqual(['id-1', 'id-2']);
    expect(streamIdField?.config.custom?.hidden).toBe(true);
  });

  it('leaves the labels field untouched (the backend already strips _stream)', () => {
    const frame = buildFrame([{ _stream_id: 'id-1', app: 'nginx' }], [{ app: 'nginx' }]);

    const [processed] = processStreamsFrames([frame], queryMap, [], []);

    const labelsField = processed.fields.find((f) => f.name === 'labels');
    expect(labelsField?.values[0]).toEqual({ _stream_id: 'id-1', app: 'nginx' });
  });

  it('keeps working when the frame carries no stream fields', () => {
    const frame = buildFrame([{ app: 'nginx' }]);

    const [processed] = processStreamsFrames([frame], queryMap, [], []);

    expect(processed.fields.find((f) => f.name === 'streams')).toBeUndefined();
    expect(processed.fields.find((f) => f.name === 'streamId')).toBeUndefined();
  });

  it('extracts searchWords from the interpolated query, not the raw one', () => {
    const rawQueryMap = new Map<string, Query>([['A', { refId: 'A', expr: '_msg:$search' }]]);
    const interpolateExpr = (expr: string) => expr.replace('$search', 'error');
    const frame = buildFrame([{ app: 'nginx' }]);

    const [processed] = processStreamsFrames([frame], rawQueryMap, [], [], interpolateExpr);

    expect(processed.meta?.searchWords).toEqual(['error']);
  });

  describe('packJson option', () => {
    const makeQueryMap = (query: Partial<Query>) =>
      new Map<string, Query>([['A', { refId: 'A', expr: '*', queryType: QueryType.Instant, ...query } as Query]]);

    it('packs labels and the message into the Line field when packJson is enabled', () => {
      const frame = buildFrame([{ app: 'nginx' }]);

      const [processed] = processStreamsFrames([frame], makeQueryMap({ packJson: true }), [], []);

      const lineField = processed.fields.find((f) => f.name === 'Line');
      expect(lineField?.values[0]).toBe('{"_msg":"msg","app":"nginx"}');
    });

    it('keeps the Line field untouched when packJson is disabled', () => {
      const frame = buildFrame([{ app: 'nginx' }]);

      const [processed] = processStreamsFrames([frame], makeQueryMap({}), [], []);

      const lineField = processed.fields.find((f) => f.name === 'Line');
      expect(lineField?.values[0]).toBe('msg');
    });

    it('keeps the Line field untouched for supporting queries (logs sample)', () => {
      const frame = buildFrame([{ app: 'nginx' }]);

      const [processed] = processStreamsFrames(
        [frame],
        makeQueryMap({ packJson: true, supportingQueryType: SupportingQueryType.LogsSample }),
        [],
        []
      );

      const lineField = processed.fields.find((f) => f.name === 'Line');
      expect(lineField?.values[0]).toBe('msg');
    });
  });
});
