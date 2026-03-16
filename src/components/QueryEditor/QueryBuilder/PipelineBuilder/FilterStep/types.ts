export const FILTER_TYPE = {
  Exact: 'exact',
  Phrase: 'phrase',
  Range: 'range',
  Regexp: 'regexp',
  CaseInsensitive: 'caseInsensitive',
  CustomPipe: 'customPipe',
} as const;

export type FilterType = (typeof FILTER_TYPE)[keyof typeof FILTER_TYPE];

export const EXACT_OPERATORS = {
  In: 'in',
  NotIn: '!in',
} as const;

export type ExactOperator = (typeof EXACT_OPERATORS)[keyof typeof EXACT_OPERATORS];

export const RANGE_OPERATORS = {
  Gt: '>',
  Gte: '>=',
  Lt: '<',
  Lte: '<=',
} as const;

export type RangeOperator = (typeof RANGE_OPERATORS)[keyof typeof RANGE_OPERATORS];

export const REGEXP_OPERATORS = {
  Match: '~',
  NotMatch: '!~',
} as const;

export type RegexpOperator = (typeof REGEXP_OPERATORS)[keyof typeof REGEXP_OPERATORS];

export const CASE_INSENSITIVE_OPERATORS = {
  Match: 'i',
  NotMatch: '!i',
} as const;

export type CaseInsensitiveOperator = (typeof CASE_INSENSITIVE_OPERATORS)[keyof typeof CASE_INSENSITIVE_OPERATORS];

export interface FilterRow {
  id: string;
  filterType: FilterType;
  fieldName: string;
  operator: string;
  values: string[];
}

let filterRowIdCounter = 0;

export const generateFilterRowId = (): string => {
  filterRowIdCounter += 1;
  return `filter-row-${Date.now()}-${filterRowIdCounter}`;
};

export const createFilterRow = ( filterType: FilterType, defaultOperator: string, fieldName = '', values = ['_msg']): FilterRow => ({
  id: generateFilterRowId(),
  filterType,
  fieldName,
  operator: defaultOperator,
  values,
});
