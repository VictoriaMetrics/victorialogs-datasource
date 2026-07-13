import { formatHits } from './formatHits';

describe('formatHits', () => {
  it('leaves small counts unformatted', () => {
    expect(formatHits(3)).toBe('3');
    expect(formatHits(30)).toBe('30');
    expect(formatHits(0)).toBe('0');
  });

  it('compacts large counts with a unit suffix, matching the short value format', () => {
    // real output of getValueFormat('short')(12345) — asserted here rather than assumed
    expect(formatHits(12345)).toBe('12.3 K');
  });
});
