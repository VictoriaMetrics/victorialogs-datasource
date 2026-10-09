import { DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { Query } from '../types';

import { isSlowResponse, slowQueryFrame, withFirstByteTimeout } from './firstByteTimeout';

describe('withFirstByteTimeout', () => {
  it('puts the budget on every target of a copy of the request', () => {
    const request = { requestId: 'r', targets: [{ refId: 'A' }, { refId: 'B' }] } as DataQueryRequest<Query>;
    const budgeted = withFirstByteTimeout(request, 3000);
    expect(budgeted.targets.map((t) => t.firstByteTimeoutMs)).toEqual([3000, 3000]);
    expect(budgeted).not.toBe(request);
    expect(request.targets[0].firstByteTimeoutMs).toBeUndefined();
  });
});

describe('isSlowResponse', () => {
  it('recognises the marker frame the backend returns for a query given up at the budget', () => {
    const slow: DataQueryResponse = { data: [slowQueryFrame('A')] };
    expect(isSlowResponse(slow)).toBe(true);
    expect(isSlowResponse({ data: [] })).toBe(false);
    expect(isSlowResponse({ data: [{ refId: 'A', fields: [], length: 0 }] })).toBe(false);
  });
});
