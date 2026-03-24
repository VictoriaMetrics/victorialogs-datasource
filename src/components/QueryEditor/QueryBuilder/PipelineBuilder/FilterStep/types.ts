export const FILTER_TYPE = {
  Exact: 'exact',
  Phrase: 'phrase',
  Range: 'range',
  Regexp: 'regexp',
  CaseInsensitive: 'caseInsensitive',
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

import { createIdGenerator } from '../shared/generateId';

export const generateFilterRowId = createIdGenerator('filter-row');

const DEFAULT_OPERATORS: Record<FilterType, string> = {
  [FILTER_TYPE.Exact]: EXACT_OPERATORS.In,
  [FILTER_TYPE.Phrase]: ':',
  [FILTER_TYPE.Range]: RANGE_OPERATORS.Gt,
  [FILTER_TYPE.Regexp]: REGEXP_OPERATORS.Match,
  [FILTER_TYPE.CaseInsensitive]: CASE_INSENSITIVE_OPERATORS.Match,
};

export const createFilterRow = (filterType: FilterType, operatorOverride?: string, fieldName = '', values: string[] = []): FilterRow => ({
  id: generateFilterRowId(),
  filterType,
  fieldName,
  operator: operatorOverride ?? DEFAULT_OPERATORS[filterType],
  values: values,
});
