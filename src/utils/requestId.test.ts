import { stripMixedRequestIdPrefix } from './requestId';

describe('stripMixedRequestIdPrefix', () => {
  it('drops the prefix of a mixed datasource sub-request', () => {
    expect(stripMixedRequestIdPrefix('mixed-0-explore_abc')).toBe('explore_abc');
    expect(stripMixedRequestIdPrefix('mixed-12-explore_abc_logs_volume_0')).toBe('explore_abc_logs_volume_0');
  });

  it('keeps a request id without the prefix', () => {
    expect(stripMixedRequestIdPrefix('explore_abc')).toBe('explore_abc');
    expect(stripMixedRequestIdPrefix('explore_mixed-1-x')).toBe('explore_mixed-1-x');
  });
});
