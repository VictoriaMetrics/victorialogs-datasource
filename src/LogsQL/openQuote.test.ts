import { getOpenQuote } from './openQuote';

describe('getOpenQuote', () => {
  it.each([
    ['', null],
    ['field:', null],
    ['field:"', '"'],
    ['field:"prefix ', '"'],
    ['field:"value" other:', null],
    ['field:"value" other:"', '"'],
    ["field:'", "'"],
    ['field:`', '`'],
    ['field:~"a\\"b', '"'],
    ['field:"a\\\\" other:', null],
    ['field:`a\\` other:', null],
    ['field:`a\\` other:"', '"'],
    ['field:"it\'s" other:', null],
    ['field:\'say "hi\' other:', null],
    ['{app="a", env="', '"'],
    ['{app="a"} | stats by (', null],
  ])('getOpenQuote(%j) is %j', (expr, expected) => {
    expect(getOpenQuote(expr)).toBe(expected);
  });
});
