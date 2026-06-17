import { DataFrame, FieldType } from '@grafana/data';

import { Query } from '../../types';

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
});
