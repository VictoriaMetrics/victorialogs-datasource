import { splitByOperator, splitByUnescapedPipe, splitString } from "./stringSplitter";

describe("splitString", () => {
  it("should return an empty array for an empty string", () => {
    expect(splitString("")).toEqual([]);
  });

  it("should split a string by spaces", () => {
    const input = "hello world";
    const expected = [
      { type: "space", value: "hello" },
      { type: "space", value: "world" },
    ];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle single quotes correctly", () => {
    const input = "'hello world'";
    const expected = [{ type: "quote", value: "'hello world'" }];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle double quotes correctly", () => {
    const input = '"hello world"';
    const expected = [{ type: "quote", value: '"hello world"' }];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle backticks correctly", () => {
    const input = "`hello world`";
    const expected = [{ type: "quote", value: "`hello world`" }];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle brackets correctly", () => {
    const input = "(hello world)";
    const expected = [
      { type: "bracket", prefix: "", value: [{ type: "space", value: "hello" }, { type: "space", value: "world" }], raw_value: "(hello world)" },
    ];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle colons correctly", () => {
    const input = "key:value";
    const expected = [
      { type: "colon", value: "key" },
      { type: "space", value: "value" },
    ];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle mixed quotes and spaces", () => {
    const input = `'hello' "world"`;
    const expected = [
      { type: "quote", value: "'hello'" },
      { type: "quote", value: '"world"' },
    ];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle escaped characters", () => {
    const input = "hello\\ world";
    const expected = [{ type: "space", value: "hello\\ world" }];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle nested brackets", () => {
    const input = "(hello (nested world))";
    const expected = [
      {
        type: "bracket",
        prefix: "",
        value: [
          { type: "space", value: "hello" },
          {
            type: "bracket",
            prefix: "",
            value: [{ type: "space", value: "nested" }, { type: "space", value: "world" }],
            raw_value: "(nested world)",
          },
        ],
        raw_value: "(hello (nested world))",
      },
    ];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle multiple types in a single string", () => {
    const input = `'hello' (world) key:value`;
    const expected = [
      { type: "quote", value: "'hello'" },
      { type: "bracket", prefix: "", value: [{ type: "space", value: "world" }], raw_value: "(world)" },
      { type: "colon", value: "key" },
      { type: "space", value: "value" },
    ];
    expect(splitString(input)).toEqual(expected);
  });

  it("should handle complex strings with various types", () => {
    const input = `'hello' (world) 'key:value' key:value 'key:value' "key:value" key:value "key:value"`;
    const expected = [
      { type: "quote", value: "'hello'" },
      { type: "bracket", prefix: "", value: [{ type: "space", value: "world" }],raw_value: "(world)" },
      { type: "quote", value: "'key:value'" },
      { type: "colon", value: "key" },
      { type: "space", value: "value" },
      { type: "quote", value: "'key:value'" },
      { type: "quote", value: '"key:value"' },
      { type: "colon", value: "key" },
      { type: "space", value: "value" },
      { type: "quote", value: '"key:value"' },
    ];
    expect(splitString(input)).toEqual(expected);
  });

  // create more test with longer strings with a lot of different types and edge cases with more nested brackets
  it("should handle complex strings with nested brackets and various types", () => {
    const input = `'hello' (world (nested "value")) key:value "key:value"`;
    const expected = [
      { type: "quote", value: "'hello'" },
      {
        prefix: "",
        type: "bracket",
        value: [
          { type: "space", value: "world" },
          { type: "bracket", prefix: "", value: [{ type: "space", value: 'nested' }, { type: "quote", value: '"value"' }], raw_value: "(nested \"value\")" },
        ],
        raw_value: "(world (nested \"value\"))",
      },
      { type: "colon", value: "key" },
      { type: "space", value: "value" },
      { type: "quote", value: '"key:value"' },
    ];
    expect(splitString(input)).toEqual(expected);
  });

  // long string with nested brackets includeing angled brackets
  it("should handle complex strings with nested brackets and angled brackets", () => {
    const input = `'hello' (world [nested "value")] key:value "key:value"`;
    const expected = [
      { type: "quote", value: "'hello'" },
      {
        prefix: "",
        type: "bracket",
        value: [
          { type: "space", value: "world" },
          { type: "bracket", prefix: "", value: [{ type: "space", value: 'nested' }, { type: "quote", value: '"value"' }], raw_value: "[nested \"value\")" },
        ],
        raw_value: "(world [nested \"value\")]",
      },
      { type: "colon", value: "key" },
      { type: "space", value: "value" },
      { type: "quote", value: '"key:value"' },
    ];
    expect(splitString(input)).toEqual(expected);
  });
  // Time filter
  it("should handle time filters correctly", () => {
    const input = "_time:<2.5d15m42.345s or \"_time\":\">2.5d15m42.345s\" OR _time:>=YYYY-MM-DDZ OR _time:[min_time, max_time] OR _time:2023-04-25T22:45:59Z";
    const expected = [
      { type: "colon", value: "_time" },
      { type: 'space', value: '<2.5d15m42.345s' },
      { type: "space", value: "or" },
      { type: "quote", value: '"_time"' },
      { type: "colon", value: "" },
      { type: "quote", value: '">2.5d15m42.345s"' },
      { type: "space", value: "OR" },
      { type: "colon", value: "_time" },
      { type: "space", value: ">" },
      { type: "space", value: "=" },
      { type: "space", value: "YYYY-MM-DDZ" },
      { type: "space", value: "OR" },
      { type: "colon", value: "_time" },
      { type: "bracket", prefix: "", value: [
        { type: "space", value: "min_time" },
        { type: "space", value: "," },
        { type: "space", value: "max_time" },
      ], raw_value: "[min_time, max_time]" },
      { type: "space", value: "OR" },
      { type: "colon", value: "_time" },
      { type: "colon", value: "2023-04-25T22" },
      { type: "colon", value: "45" },
      { type: "space", value: "59Z" },
    ];
    expect(splitString(input)).toEqual(expected);
  });
});


describe('splitByUnescapedPipe', () => {
  it('should split by unescaped pipe', () => {
    const str = splitString('a|b|c');
    const result = splitByUnescapedPipe(str);
    expect(result).toEqual([
      [ { type: "space", value: 'a' } ],
      [ { type: "space", value: 'b' } ],
      [ { type: "space", value: 'c' } ]
    ]);
  });

  it('should not split by escaped pipe', () => {
    const str = splitString('a\\|b|c');
    const result = splitByUnescapedPipe(str);
    expect(result).toEqual([
      [ { type: "space", value: 'a\\|b' } ],
      [ { type: "space", value: 'c' } ]
    ]);
  });

  it('should not split by escaped pipe in quotes', () => {
    const str = splitString('a\\|b:"c|d"');
    const result = splitByUnescapedPipe(str);
    expect(result).toEqual([[
      { type: "colon", value: 'a\\|b' },
      { type: "quote", value: '"c|d"' } 
    ]]);
  });

  it('should not split by escaped pipe in quotes', () => {
    const str = splitString('a\\|b:\\"c|d\\"');
    const result = splitByUnescapedPipe(str);
    expect(result).toEqual([
      [ { type: "colon", value: 'a\\|b' },
        { type: "space", value: '\\\"c' }
      ], [
        { type: "space", value: 'd\\"' }
       ]
    ]);
  });
});

describe('splitByOperator', () => {
  it('should split by unescaped operator', () => {
    const str = splitString('a and b or c');
    const result = splitByOperator(str);
    expect(result).toEqual([
      [ { type: 'space', value: 'a' } ],
      [ { type: 'space', value: 'and' } ],
      [ { type: 'space', value: 'b' } ],
      [ { type: 'space', value: 'or' } ],
      [ { type: 'space', value: 'c' } ]
    ]);
  });

  it('should split by unescaped operator, but not in quotes', () => {
    const str = splitString('a\' and b\' or c');
    const result = splitByOperator(str);
    expect(result).toEqual([
      [ { type: "space", value: "a" },
        { type: "quote", value: "' and b'" } ],
      [ { type: "space", value: "or" } ],
      [ { type: "space", value: "c" } ]
    ]);
  });
});

