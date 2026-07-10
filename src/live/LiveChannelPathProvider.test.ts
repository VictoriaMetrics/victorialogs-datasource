import { Query } from '../types';
import { hashString } from '../utils';

import { LiveChannelPathProvider } from './LiveChannelPathProvider';

function buildQuery(overrides: Partial<Query> = {}): Query {
  return { refId: 'A', expr: '*', ...overrides } as Query;
}

describe('LiveChannelPathProvider', () => {
  let provider: LiveChannelPathProvider;

  beforeEach(() => {
    provider = new LiveChannelPathProvider();
  });

  it('returns a stable path for the same query', () => {
    const query = buildQuery();
    expect(provider.getPath('req_1', query)).toBe(provider.getPath('req_1', query));
  });

  it('keeps the path stable when only editor-only fields change', () => {
    const first = provider.getPath('req_1', buildQuery({ editorMode: 'code' } as Partial<Query>));
    const second = provider.getPath('req_1', buildQuery({ editorMode: 'builder', legendFormat: '{{app}}' } as Partial<Query>));
    expect(second).toBe(first);
  });

  it('changes the path when the expression changes', () => {
    const first = provider.getPath('req_1', buildQuery({ expr: 'info' }));
    const second = provider.getPath('req_1', buildQuery({ expr: 'error' }));
    expect(second).not.toBe(first);
  });

  it('changes the path when extra filters change', () => {
    const first = provider.getPath('req_1', buildQuery());
    const second = provider.getPath('req_1', buildQuery({ extraFilters: 'level:="error"' }));
    expect(second).not.toBe(first);
  });

  it('changes the path even when the new query collides in the 32-bit hash', () => {
    // "Aa" and "BB" collide in the Java String.hashCode polynomial (31*'A'+'a' === 31*'B'+'B'),
    // and the collision survives identical JSON prefixes/suffixes around the expression
    const first = buildQuery({ expr: 'Aa' });
    const second = buildQuery({ expr: 'BB' });
    const firstPath = provider.getPath('req_1', first);
    const secondPath = provider.getPath('req_1', second);

    // guard: the inputs must actually collide, otherwise this test checks nothing
    expect(hashString(JSON.stringify({ expr: 'Aa', extraFilters: undefined, extraStreamFilters: undefined })))
      .toBe(hashString(JSON.stringify({ expr: 'BB', extraFilters: undefined, extraStreamFilters: undefined })));
    expect(secondPath).not.toBe(firstPath);
  });

  it('tracks generations independently per requestId and refId', () => {
    const pathA = provider.getPath('req_1', buildQuery({ refId: 'A' }));
    const pathB = provider.getPath('req_1', buildQuery({ refId: 'B' }));
    const pathOtherRequest = provider.getPath('req_2', buildQuery({ refId: 'A' }));

    expect(pathA).not.toBe(pathB);
    expect(pathA).not.toBe(pathOtherRequest);
    // an edit under one key must not restart streams under the others
    provider.getPath('req_1', buildQuery({ refId: 'A', expr: 'error' }));
    expect(provider.getPath('req_1', buildQuery({ refId: 'B' }))).toBe(pathB);
  });

  describe('release', () => {
    it('evicts the channel state when the released path is current', () => {
      provider.getPath('req_1', buildQuery({ expr: 'error' }));
      const current = provider.getPath('req_1', buildQuery({ expr: 'info' }));

      provider.release('req_1', 'A', current);

      // the state was dropped, so the generation counter restarts from zero
      const fresh = provider.getPath('req_1', buildQuery({ expr: 'info' }));
      expect(fresh).not.toBe(current);
      expect(fresh).toContain('/0-');
    });

    it('keeps the state when a newer generation replaced the released path', () => {
      const stale = provider.getPath('req_1', buildQuery({ expr: 'error' }));
      const current = provider.getPath('req_1', buildQuery({ expr: 'info' }));

      // a late teardown of the previous stream must not evict the active state
      provider.release('req_1', 'A', stale);

      expect(provider.getPath('req_1', buildQuery({ expr: 'info' }))).toBe(current);
    });

    it('ignores a release for an unknown channel', () => {
      expect(() => provider.release('req_1', 'A', 'req_1/A/0-abc')).not.toThrow();
    });
  });
});
