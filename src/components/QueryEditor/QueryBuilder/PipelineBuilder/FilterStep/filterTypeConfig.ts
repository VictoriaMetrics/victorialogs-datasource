import React from 'react';

import FieldNameSelect, { FieldComponentProps } from '../shared/FieldNameSelect';

import ExactValueSelect from './parts/ExactValueSelect';
import { createOperatorSelect } from './parts/OperatorSelect';
import StaticOperatorLabel, { OperatorComponentProps } from './parts/StaticOperatorLabel';
import TextValueInput, { ValueComponentProps } from './parts/TextValueInput';
import { EXACT_OPERATORS, FILTER_TYPE, FilterType, RANGE_OPERATORS } from './types';

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

export interface FilterTypeDefinition {
  label: string;
  defaultOperator: string;
  FieldComponent: React.FC<FieldComponentProps>;
  OperatorComponent: React.FC<OperatorComponentProps>;
  ValueComponent: React.FC<ValueComponentProps>;
}

const FILTER_TYPE_CONFIG: Record<FilterType, FilterTypeDefinition> = {
  [FILTER_TYPE.Exact]: {
    label: 'Exact match',
    defaultOperator: EXACT_OPERATORS.In,
    FieldComponent: FieldNameSelect,
    OperatorComponent: ExactOperatorSelect,
    ValueComponent: ExactValueSelect,
  },
  [FILTER_TYPE.Phrase]: {
    label: 'Phrase',
    defaultOperator: ':',
    FieldComponent: FieldNameSelect,
    OperatorComponent: StaticOperatorLabel,
    ValueComponent: TextValueInput,
  },
  [FILTER_TYPE.Range]: {
    label: 'Range',
    defaultOperator: RANGE_OPERATORS.Gt,
    FieldComponent: FieldNameSelect,
    OperatorComponent: RangeOperatorSelect,
    ValueComponent: TextValueInput,
  },
  [FILTER_TYPE.Regexp]: {
    label: 'Regexp',
    defaultOperator: '~',
    FieldComponent: FieldNameSelect,
    OperatorComponent: StaticOperatorLabel,
    ValueComponent: TextValueInput,
  },
  [FILTER_TYPE.CaseInsensitive]: {
    label: 'Case-insensitive',
    defaultOperator: ':i',
    FieldComponent: FieldNameSelect,
    OperatorComponent: StaticOperatorLabel,
    ValueComponent: TextValueInput,
  },
};

export default FILTER_TYPE_CONFIG;

export const FILTER_TYPE_ENTRIES = Object.entries(FILTER_TYPE_CONFIG).map(([filterType, config]) => ({
  filterType: filterType as FilterType,
  label: config.label,
  defaultOperator: config.defaultOperator,
}));

