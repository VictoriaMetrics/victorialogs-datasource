import { DataQueryResponse } from '@grafana/data';

import { responseErrors } from './dataQueryResponse';

describe('responseErrors', () => {
  it('returns no errors for a clean response', () => {
    expect(responseErrors({ data: [] })).toEqual([]);
  });

  it('prefers `errors` and falls back to the deprecated `error`', () => {
    expect(responseErrors({ data: [], errors: [{ message: 'a' }, { message: 'b' }] }).map((e) => e.message)).toEqual(['a', 'b']);
    const legacy: DataQueryResponse = { data: [], error: { message: 'legacy' } };
    expect(responseErrors(legacy).map((e) => e.message)).toEqual(['legacy']);
  });

  it('fills in the message from the other fields, skipping empty strings', () => {
    expect(responseErrors({ data: [], errors: [{ data: { message: 'from data' } }] })[0].message).toBe('from data');
    expect(responseErrors({ data: [], errors: [{ message: '', statusText: 'Bad Gateway' }] })[0].message).toBe('Bad Gateway');
    expect(responseErrors({ data: [], errors: [{ message: '', statusText: '' }] })[0].message).toBe('Query failed');
  });
});
