import { correctMultiExactOperatorValueAll } from './multiExactOperator';

describe('multiExactOperator', () => {
  describe('correctMultiExactOperatorAllValue', () => {
    it('should replace standard ": in(.*)" with ":in(*)"', () => {
      const input = 'label: in(.*)';
      const expected = 'label:in(*)';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should handle different amounts of whitespace after the colon', () => {
      const input = 'field:in(.*) AND other:  in(.*)';
      const expected = 'field:in(*) AND other:in(*)';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should replace multiple occurrences in a single string', () => {
      const input = 'status: in(.*), level: in(.*), app: "web"';
      const expected = 'status:in(*), level:in(*), app: "web"';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should NOT replace if the pattern is slightly different (e.g., missing dot)', () => {
      const input = 'label: in(*)'; // already corrected
      expect(correctMultiExactOperatorValueAll(input)).toBe(input);
    });

    it('should NOT replace if it is a regular in operator with values', () => {
      const input = 'label: in("val1", "val2")';
      expect(correctMultiExactOperatorValueAll(input)).toBe(input);
    });

    it('should return the same string if no matches are found', () => {
      const input = '{job="vmagent"} | "error"';
      expect(correctMultiExactOperatorValueAll(input)).toBe(input);
    });

    it('should handle empty strings', () => {
      expect(correctMultiExactOperatorValueAll('')).toBe('');
    });

    it('should handle complex strings where pattern is part of a larger expression', () => {
      const input = '_stream:{label in(.*)} | count() by (level)';
      const expected = '_stream:{label in(*)} | count() by (level)';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should handle stream label with double quotes', () => {
      const input = '_stream:{"label" in(.*)} | count() by (level)';
      const expected = '_stream:{"label" in(*)} | count() by (level)';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });
  });
});
