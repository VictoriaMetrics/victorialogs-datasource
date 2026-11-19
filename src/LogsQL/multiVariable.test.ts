import { replaceMultiVariables, wrapMultiVariable } from './multiVariable';

const VALUE = 'a"b\\d c';
const ESCAPED = 'a\\"b\\\\d c';

const expand = (expr: string, ...values: string[][]) => {
  let index = 0;
  return replaceMultiVariables(expr.replace(/\$var\b/g, () => wrapMultiVariable(values[index++] ?? values[0])));
};

describe('replaceMultiVariables', () => {
  it('should return the query without placeholders as is', () => {
    expect(replaceMultiVariables('field:"value" | stats count()')).toBe('field:"value" | stats count()');
  });

  describe('value inside a double-quoted string', () => {
    it.each([
      ['f:"$var"', `f:"${ESCAPED}"`],
      ['f:="$var"', `f:="${ESCAPED}"`],
      ['f:!"$var"', `f:!"${ESCAPED}"`],
      ['f:"prefix $var suffix"', `f:"prefix ${ESCAPED} suffix"`],
      ['{app="$var"}', `{app="${ESCAPED}"}`],
      ['f:"a" | g:"$var"', `f:"a" | g:"${ESCAPED}"`],
      ['f:~"$var"', `f:~"(${ESCAPED})"`],
      ['{app=~"$var"}', `{app=~"(${ESCAPED})"}`],
      ['f:!~"$var"', `f:!~"(${ESCAPED})"`],
      ['{app!~"$var"}', `{app!~"(${ESCAPED})"}`],
    ])('should escape the value in %s', (expr, expected) => {
      expect(expand(expr, [VALUE])).toBe(expected);
    });

    it('should escape every value of a multi-value variable', () => {
      expect(expand('f:"$var"', ['a"b', 'c\\d'])).toBe('f:"a\\"b OR c\\\\d"');
      expect(expand('f:~"$var"', ['a"b', 'c\\d'])).toBe('f:~"(a\\"b|c\\\\d)"');
      expect(expand('f:!~"$var"', ['a"b', 'c\\d'])).toBe('f:!~"(a\\"b|c\\\\d)"');
      expect(expand('{app!~"$var"}', ['a', 'b'])).toBe('{app!~"(a|b)"}');
    });
  });

  describe('value outside of a double-quoted string', () => {
    it.each([
      ['$var', VALUE],
      ['f:$var', `f:${VALUE}`],
      ['f:=$var', `f:=${VALUE}`],
      ['f:`$var`', `f:\`${VALUE}\``],
      ["f:'$var'", `f:'${VALUE}'`],
      ['f:"a" $var', `f:"a" ${VALUE}`],
      ['f:"a\\"" $var', `f:"a\\"" ${VALUE}`],
    ])('should keep the value raw in %s', (expr, expected) => {
      expect(expand(expr, [VALUE])).toBe(expected);
    });

    it('should join the values of a multi-value variable with OR', () => {
      expect(expand('f:$var', ['foo', 'bar'])).toBe('f:foo OR bar');
    });
  });

  describe('value inside in()', () => {
    it('should quote the values', () => {
      expect(expand('f:in($var)', ['a"b', 'c\\d'])).toBe('f:in("a\\"b","c\\\\d")');
      expect(expand('{app in ($var)}', ['foo', 'bar'])).toBe('{app in ("foo","bar")}');
    });
  });

  describe('value with a line break', () => {
    it.each([
      ['f:in($var)', 'f:in("a\\nb")'],
      ['f:"$var"', 'f:"a\\nb"'],
      ['f:~"$var"', 'f:~"(a\\nb)"'],
      ['f:`$var`', 'f:`a\nb`'],
      ['f:$var', 'f:a\nb'],
    ])('should replace the placeholder in %s', (expr, expected) => {
      expect(expand(expr, ['a\nb'])).toBe(expected);
    });

    it('should replace each placeholder of a multi-line query', () => {
      expect(expand('f:"$var"\n| g:in($var)', ['a\nb'], ['c\nd', 'e'])).toBe('f:"a\\nb"\n| g:in("c\\nd","e")');
    });
  });

  describe('empty value', () => {
    it.each([
      ['f:in($var)', 'f:in("")'],
      ['f:"$var"', 'f:""'],
      ['f:~"$var"', 'f:~"()"'],
      ['f:$var', 'f:'],
    ])('should replace the placeholder of a single empty value in %s', (expr, expected) => {
      expect(expand(expr, [''])).toBe(expected);
    });

    it('should keep an empty value next to other values', () => {
      expect(expand('f:in($var)', ['', 'x'])).toBe('f:in("","x")');
      expect(expand('f:~"$var"', ['', 'x'])).toBe('f:~"(|x)"');
    });
  });

  describe('several variables', () => {
    it('should not let a quote in a value change the place of the next variable', () => {
      expect(expand('f:"$var" g:"$var"', ['a"b'], ['c"d'])).toBe('f:"a\\"b" g:"c\\"d"');
      expect(expand('f:$var g:$var', ['a"b'], ['c"d'])).toBe('f:a"b g:c"d');
      expect(expand('f:"$var" g:~"$var"', ['a"b'], ['c\\d'])).toBe('f:"a\\"b" g:~"(c\\\\d)"');
      expect(expand('f:"$var" g:in($var)', ['a"b'], ['c', 'd'])).toBe('f:"a\\"b" g:in("c","d")');
    });
  });
});
