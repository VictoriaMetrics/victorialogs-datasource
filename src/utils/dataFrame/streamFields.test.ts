import { DataFrame } from '@grafana/data';

import { frameHasStreamField } from './streamFields';

const makeFrame = (streams?: Array<Record<string, string> | null>): DataFrame =>
  ({
    fields: streams === undefined ? [] : [{ name: 'streams', values: streams }],
    length: streams?.length ?? 0,
  }) as unknown as DataFrame;

describe('frameHasStreamField', () => {
  it('returns true when the key is present in a row of the hidden streams field', () => {
    const frame = makeFrame([{ app: 'nginx', namespace: 'prod' }]);
    expect(frameHasStreamField(frame, 'app')).toBe(true);
  });

  it('returns true when the key is present only in a later row', () => {
    const frame = makeFrame([null, { instance: 'i-1' }]);
    expect(frameHasStreamField(frame, 'instance')).toBe(true);
  });

  it('returns false when the key is absent from all stream maps', () => {
    const frame = makeFrame([{ app: 'nginx' }]);
    expect(frameHasStreamField(frame, 'level')).toBe(false);
  });

  it('ignores inherited object properties like toString', () => {
    const frame = makeFrame([{ app: 'nginx' }]);
    expect(frameHasStreamField(frame, 'toString')).toBe(false);
    expect(frameHasStreamField(frame, 'constructor')).toBe(false);
  });

  it('returns false when the streams field is missing', () => {
    expect(frameHasStreamField(makeFrame(undefined), 'app')).toBe(false);
  });

  it('returns false when frame is undefined', () => {
    expect(frameHasStreamField(undefined, 'app')).toBe(false);
  });

  it('returns false for null-only rows', () => {
    expect(frameHasStreamField(makeFrame([null, null]), 'app')).toBe(false);
  });
});
