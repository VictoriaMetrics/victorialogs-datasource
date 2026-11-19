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

    it('should  replace if the pattern is slightly different: extra space', () => {
      const input = 'label:in(*)'; // already corrected
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

    it('should replace ": in(".*")" with ":in(*)"', () => {
      const input = 'label: in(".*")';
      const expected = 'label:in(*)';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should replace "word in(".*")" with "word in(*)"', () => {
      const input = '_stream:{label in(".*")}';
      const expected = '_stream:{label in(*)}';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should replace ": in("*")" with ":in(*)"', () => {
      const input = 'label: in("*")';
      const expected = 'label:in(*)';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should replace "word in("*")" with "word in(*)"', () => {
      const input = '_stream:{label in("*")}';
      const expected = '_stream:{label in(*)}';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should replace "word in(*)" after a quoted field name', () => {
      const input = '_stream:{"my label"   in( ".*" )}';
      const expected = '_stream:{"my label" in(*)}';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should replace every "word in(*)" of the query', () => {
      const input = '_stream:{app in(.*), env in("*")} label: in(".*")';
      const expected = '_stream:{app in(*), env in(*)} label:in(*)';
      expect(correctMultiExactOperatorValueAll(input)).toBe(expected);
    });

    it('should not change a list of values', () => {
      const input = '_stream:{app in("a","b")} label:in("c","d")';
      expect(correctMultiExactOperatorValueAll(input)).toBe(input);
    });

    it('should handle a long list of values without spaces in linear time', () => {
      const values = Array.from({ length: 2500 }, (_, i) => `"service-name.${i}.example.com"`);
      const input = `_stream:{app in(.*)} label:in(${values.join(',')})`;
      const expected = `_stream:{app in(*)} label:in(${values.join(',')})`;

      const start = performance.now();
      const result = correctMultiExactOperatorValueAll(input);
      const duration = performance.now() - start;

      expect(result).toBe(expected);
      // the quadratic version took seconds here
      expect(duration).toBeLessThan(500);
    });
  });
});
