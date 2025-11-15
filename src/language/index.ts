import { languages } from "monaco-editor";

export const languageConfiguration: languages.LanguageConfiguration = {
  // the default separators except `@$`
  wordPattern: /(-?\d*\.\d\w*)|([^`~!#%^&*()\-=+\[{\]}\\|;:'",.<>\/?\s]+)/g,
  comments: {
    lineComment: "#",
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: "`", close: "`" },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: "`", close: "`" },
    { open: "<", close: ">" },
  ],
  folding: {},
};

// LogQL built-in aggregation operators
// https://grafana.com/docs/loki/latest/logql/metric_queries/#built-in-aggregation-operators
const aggregations = [
  "sum",
  "avg",
  "min",
  "max",
  "stddev",
  "stdvar",
  "count",
  "topk",
  "bottomk",
];

// LogQL parser expressions
// https://grafana.com/docs/loki/latest/logql/log_queries/#parser-expression
const parsers = ["json", "logfmt", "regexp", "unpack", "pattern"];

// LogQL format expressions
// https://grafana.com/docs/loki/latest/logql/log_queries/#parser-expression

const format_expressions = ["line_format", "label_format"];

// LogQL vector aggregations
// https://grafana.com/docs/loki/latest/logql/metric_queries/#range-vector-aggregation
const vector_aggregations = [
  "count_over_time",
  "rate",
  "bytes_over_time",
  "bytes_rate",
  "avg_over_time",
  "sum_over_time",
  "min_over_time",
  "max_over_time",
  "stdvar_over_time",
  "stddev_over_time",
  "quantile_over_time",
  "first_over_time",
  "last_over_time",
  "absent_over_time",
];

// LogQL by and without clauses
const vector_matching = ["by", "without"];
// Produce a regex matching elements : (by|without)
const vectorMatchingRegex = `(${vector_matching.reduce(
  (prev, curr) => `${prev}|${curr}`
)})`;

// LogQL Operators
const operators = [
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "|=",
  "!=",
  "|~",
  "!~",
  "and",
  "or",
  "unless",
  "|",
];

// Merging all the keywords in one list
const keywords = aggregations
  .concat(parsers)
  .concat(format_expressions)
  .concat(vector_aggregations)
  .concat(vector_matching);

export const monarchlanguage: languages.IMonarchLanguage = {
  ignoreCase: false,
  defaultToken: "",
  tokenPostfix: ".vlogsql",
  keywords: keywords,
  operators: operators,
  vectorMatching: vectorMatchingRegex,

  // we include these common regular expressions
  symbols: /[=><!~?:&|+\-*\/^%]+/,
  escapes:
    /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  digits: /\d+(_+\d+)*/,
  octaldigits: /[0-7]+(_+[0-7]+)*/,
  binarydigits: /[0-1]+(_+[0-1]+)*/,
  hexdigits: /[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,
  integersuffix: /(ll|LL|u|U|l|L)?(ll|LL|u|U|l|L)?/,
  floatsuffix: /[fFlL]?/,

  // The main tokenizer for our languages
  tokenizer: {
    root: [
      // 'by', 'without' and vector matching
      [/@vectorMatching\s*(?=\()/, "type", "@clauses"],

      // labels
      [/[a-z_]\w*(?=\s*(=|!=|=~|!~))/, "tag"],

      // comments
      [/(^#.*$)/, "comment"],

      // all keywords have the same color
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            "@keywords": "type",
            "@default": "identifier",
          },
        },
      ],

      // strings
      [/"/, "string", "@string_double"],
      [/'/, "string", "@string_single"],
      [/`/, "string", "@string_backtick"],

      // whitespace
      { include: "@whitespace" },

      // delimiters and operators
      [/[{}()\[\]]/, "@brackets"],
      [/[<>](?!@symbols)/, "@brackets"],
      [
        /@symbols/,
        {
          cases: {
            "@operators": "delimiter",
            "@default": "",
          },
        },
      ],

      // numbers
      [/\d+(?:\.\d)?(?:ms|ns|us|µs|[smhdwy])/, "number"], // durations
      [/\d+(?:\.\d)?(?:b|kib|Kib|kb|KB|mib|Mib|mb|MB|gib|Gib|gb|GB|tib|Tib|tb|TB|pib|Pib|pb|PB|eib|Eib|eb|EB])/, "number"], // bytes
      [/\d*\d+[eE]([\-+]?\d+)?(@floatsuffix)/, "number.float"],
      [/\d*\.\d+([eE][\-+]?\d+)?(@floatsuffix)/, "number.float"],
      [/0[xX][0-9a-fA-F']*[0-9a-fA-F](@integersuffix)/, "number.hex"],
      [/0[0-7']*[0-7](@integersuffix)/, "number.octal"],
      [/0[bB][0-1']*[0-1](@integersuffix)/, "number.binary"],
      [/\d[\d']*\d(@integersuffix)/, "number"],
      [/\d(@integersuffix)/, "number"],
    ],

    string_double: [
      // Set to token: number to differentiate color
      [/\{\{(.*?)\}\}/, { token: 'number' }],
      [/[^\\"]/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, "string", "@pop"],
    ],

    string_single: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/'/, "string", "@pop"],
    ],

    string_backtick: [
      // Set to token: number to differentiate color
      [/\{\{(.*?)\}\}/, { token: 'number' }],
      [/[^\\`]/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/`/, "string", "@pop"],
    ],

    clauses: [
      [/[^(,)]/, "tag"],
      [/\)/, "identifier", "@pop"],
    ],

    whitespace: [[/[ \t\r\n]+/, "white"]],
  },
};
