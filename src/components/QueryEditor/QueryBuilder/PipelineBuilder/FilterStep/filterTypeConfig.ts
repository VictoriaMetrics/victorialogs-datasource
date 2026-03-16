import React from 'react';

import { escapeQuotes, RowSerializeResult } from '../serialization/types';
import FieldNameSelect, { FieldComponentProps } from '../shared/FieldNameSelect';

import ExactValueSelect from './parts/ExactValueSelect';
import { createOperatorSelect } from './parts/OperatorSelect';
import StaticOperatorLabel, { OperatorComponentProps } from './parts/StaticOperatorLabel';
import TextValueInput, { ValueComponentProps } from './parts/TextValueInput';
import { CASE_INSENSITIVE_OPERATORS, EXACT_OPERATORS, FILTER_TYPE, FilterRow, FilterType, RANGE_OPERATORS, REGEXP_OPERATORS } from './types';

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

export interface ValueWrapper {
  open: string;
  close: string;
}

const isFilterRowEmpty = (row: FilterRow): boolean => !row.fieldName || !row.values.length;

export interface FilterTypeDefinition {
  label: string;
  defaultOperator: string;
  FieldComponent: React.FC<FieldComponentProps>;
  OperatorComponent: React.FC<OperatorComponentProps>;
  ValueComponent: React.FC<ValueComponentProps>;
  valueWrapper?: ValueWrapper;
  serialize: (row: FilterRow, stepId: string) => RowSerializeResult;
}

const FILTER_TYPE_CONFIG: Record<FilterType, FilterTypeDefinition> = {
  [FILTER_TYPE.Exact]: {
    label: 'Exact match',
    defaultOperator: EXACT_OPERATORS.In,
    FieldComponent: FieldNameSelect,
    OperatorComponent: ExactOperatorSelect,
    ValueComponent: ExactValueSelect,
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
    FieldComponent: FieldNameSelect,
    OperatorComponent: StaticOperatorLabel,
    ValueComponent: TextValueInput,
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
    FieldComponent: FieldNameSelect,
    OperatorComponent: RangeOperatorSelect,
    ValueComponent: TextValueInput,
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
    FieldComponent: FieldNameSelect,
    OperatorComponent: RegexpOperatorSelect,
    ValueComponent: TextValueInput,
    valueWrapper: { open: '"', close: '"' },
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
    FieldComponent: FieldNameSelect,
    OperatorComponent: CaseInsensitiveOperatorSelect,
    ValueComponent: TextValueInput,
    valueWrapper: { open: '(', close: ')' },
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${row.operator}(${escapeQuotes(row.values[0])})` };
    },
  },
};

export default FILTER_TYPE_CONFIG;

export const FILTER_TYPE_ENTRIES = Object.entries(FILTER_TYPE_CONFIG).map(([filterType, config]) => ({
  filterType: filterType as FilterType,
  label: config.label,
  defaultOperator: config.defaultOperator,
}));
