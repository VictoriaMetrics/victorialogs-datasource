import { DataFrame, FieldType } from '@grafana/data';

import { Query, QueryType, SupportingQueryType } from '../../types';

import { processStreamsFrames } from './streamFrameProcessor';

const buildFrame = (labels: object[], custom?: Record<string, unknown>): DataFrame => ({
  refId: 'A',
  length: labels.length,
  meta: custom ? { custom } : undefined,
  fields: [
    { name: 'Time', type: FieldType.time, config: {}, values: labels.map((_, i) => i) },
    { name: 'Line', type: FieldType.string, config: {}, values: labels.map(() => 'msg') },
    { name: 'labels', type: FieldType.other, config: {}, values: labels },
  ],
});

describe('processStreamsFrames', () => {
  const queryMap = new Map<string, Query>([['A', { refId: 'A', expr: '*' }]]);

  it('passes the backend meta.custom streams/streamIds through untouched', () => {
    const streams = [{ app: 'nginx' }, { app: 'apache' }];
    const streamIds = ['id-1', 'id-2'];
    const frame = buildFrame(
      [
        { _stream_id: 'id-1', app: 'nginx' },
        { _stream_id: 'id-2', app: 'apache' },
      ],
      { streams, streamIds }
    );

    const [processed] = processStreamsFrames([frame], queryMap, [], []);

    expect(processed.meta?.custom?.streams).toEqual(streams);
    expect(processed.meta?.custom?.streamIds).toEqual(streamIds);
  });

  it('leaves the labels field untouched (the backend already strips _stream)', () => {
    const frame = buildFrame([{ _stream_id: 'id-1', app: 'nginx' }], {
      streams: [{ app: 'nginx' }],
      streamIds: ['id-1'],
    });

    const [processed] = processStreamsFrames([frame], queryMap, [], []);

    const labelsField = processed.fields.find((f) => f.name === 'labels');
    expect(labelsField?.values[0]).toEqual({ _stream_id: 'id-1', app: 'nginx' });
  });

  it('keeps working when the frame carries no stream meta', () => {
    const frame = buildFrame([{ app: 'nginx' }]);

    const [processed] = processStreamsFrames([frame], queryMap, [], []);

    expect(processed.meta?.custom?.streams).toBeUndefined();
    expect(processed.meta?.custom?.streamIds).toBeUndefined();
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
