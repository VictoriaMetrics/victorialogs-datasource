import React from 'react';

import { escapeQuotes, RowSerializeResult } from '../serialization/types';

import CustomPipeContent from './parts/CustomPipeContent';
import ExactValueSelect from './parts/ExactValueSelect';
import { createOperatorSelect } from './parts/OperatorSelect';
import { FilterRowContentProps, createStandardFilterContent } from './parts/StandardFilterContent';
import StaticOperatorLabel from './parts/StaticOperatorLabel';
import TextValueInput from './parts/TextValueInput';
import { CASE_INSENSITIVE_OPERATORS, EXACT_OPERATORS, FILTER_TYPE, FilterRow, FilterType, RANGE_OPERATORS, REGEXP_OPERATORS } from './types';

export type { FilterRowContentProps } from './parts/StandardFilterContent';

export interface FilterTypeDefinition {
  label: string;
  defaultOperator: string;
  ContentComponent: React.FC<FilterRowContentProps>;
  serialize: (row: FilterRow, stepId: string) => RowSerializeResult;
}

const ExactOperatorSelect = createOperatorSelect([
  { label: 'in', value: EXACT_OPERATORS.In },
  { label: 'not in', value: EXACT_OPERATORS.NotIn },
]);

const RangeOperatorSelect = createOperatorSelect([
  { label: '>', value: RANGE_OPERATORS.Gt },
  { label: '>=', value: RANGE_OPERATORS.Gte },
  { label: '<', value: RANGE_OPERATORS.Lt },
  { label: '<=', value: RANGE_OPERATORS.Lte },
]);

const RegexpOperatorSelect = createOperatorSelect([
  { label: '~', value: REGEXP_OPERATORS.Match },
  { label: '!~', value: REGEXP_OPERATORS.NotMatch },
]);

const CaseInsensitiveOperatorSelect = createOperatorSelect([
  { label: 'i', value: CASE_INSENSITIVE_OPERATORS.Match },
  { label: '!i', value: CASE_INSENSITIVE_OPERATORS.NotMatch },
]);

const isFilterRowEmpty = (row: FilterRow): boolean => !row.fieldName || !row.values.length;

const FILTER_TYPE_CONFIG: Record<FilterType, FilterTypeDefinition> = {
  [FILTER_TYPE.Exact]: {
    label: 'Exact match',
    defaultOperator: EXACT_OPERATORS.In,
    ContentComponent: createStandardFilterContent(ExactOperatorSelect, ExactValueSelect),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      const escaped = row.values.map((v) => `"${escapeQuotes(v)}"`).join(',');
      return { result: `${row.fieldName}:${row.operator}(${escaped})` };
    },
  },
  [FILTER_TYPE.Phrase]: {
    label: 'Phrase',
    defaultOperator: ':',
    ContentComponent: createStandardFilterContent(StaticOperatorLabel, TextValueInput),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${escapeQuotes(row.values[0])}` };
    },
  },
  [FILTER_TYPE.Range]: {
    label: 'Range',
    defaultOperator: RANGE_OPERATORS.Gt,
    ContentComponent: createStandardFilterContent(RangeOperatorSelect, TextValueInput),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${row.operator}${row.values[0]}` };
    },
  },
  [FILTER_TYPE.Regexp]: {
    label: 'Regexp',
    defaultOperator: REGEXP_OPERATORS.Match,
    ContentComponent: createStandardFilterContent(RegexpOperatorSelect, TextValueInput, { open: '"', close: '"' }),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${row.operator}"${escapeQuotes(row.values[0])}"` };
    },
  },
  [FILTER_TYPE.CaseInsensitive]: {
    label: 'Case-insensitive',
    defaultOperator: CASE_INSENSITIVE_OPERATORS.Match,
    ContentComponent: createStandardFilterContent(CaseInsensitiveOperatorSelect, TextValueInput, { open: '(', close: ')' }),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${row.operator}(${escapeQuotes(row.values[0])})` };
    },
  },
  [FILTER_TYPE.CustomPipe]: {
    label: 'Custom value',
    defaultOperator: '',
    ContentComponent: CustomPipeContent as React.FC<FilterRowContentProps>,
    serialize: (row) => {
      if (!row.values[0]) {
        return { result: '' };
      }
      return { result: row.values[0] };
    },
  },
};

export default FILTER_TYPE_CONFIG;

export const FILTER_TYPE_ENTRIES = Object.entries(FILTER_TYPE_CONFIG)
  .filter(([key]) => key !== FILTER_TYPE.CustomPipe)
  .map(([filterType, config]) => ({
    filterType: filterType as FilterType,
    label: config.label,
    defaultOperator: config.defaultOperator,
  }));
