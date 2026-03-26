import { escapeQuotes } from '../serialization/types';
import { BaseTypeDefinition } from '../shared/types';
import { PipelineStepPatch } from '../types';

import AllValueInput from './parts/AllValueInput';
import ExactValueSelect from './parts/ExactValueSelect';
import { createOperatorSelect } from './parts/OperatorSelect';
import { FilterRowContentProps, createStandardFilterContent } from './parts/StandardFilterContent';
import StaticOperatorLabel from './parts/StaticOperatorLabel';
import TextValueInput from './parts/TextValueInput';
import { CASE_INSENSITIVE_OPERATORS, EXACT_OPERATORS, FILTER_TYPE, FilterRow, FilterType, RANGE_OPERATORS, REGEXP_OPERATORS, createFilterRow } from './types';

export type { FilterRowContentProps } from './parts/StandardFilterContent';

export type FilterGroup = 'Match' | 'Pattern' | 'Utility';

export interface FilterTypeDefinition extends BaseTypeDefinition<FilterRow, FilterRowContentProps> {
  group: FilterGroup;
  defaultOperator: string;
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
  [FILTER_TYPE.All]: {
    label: 'All logs',
    description: 'Matches all log messages',
    group: 'Utility',
    defaultOperator: '',
    ContentComponent: AllValueInput,
    serialize: (_row, _stepId) => ({ result: '*' }),
    createInitialRow: () => ({ values: [] }),
  },
  [FILTER_TYPE.Exact]: {
    label: 'Exact match',
    description: 'Filters by exact field values using in/not in operators',
    group: 'Match',
    defaultOperator: EXACT_OPERATORS.In,
    ContentComponent: createStandardFilterContent(ExactOperatorSelect, ExactValueSelect),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      const escaped = row.values.map((v) => `"${escapeQuotes(v)}"`).join(',');
      return { result: `${row.fieldName}:${row.operator}(${escaped})` };
    },
    createInitialRow: () => ({ values: [] }),
  },
  [FILTER_TYPE.Phrase]: {
    label: 'Phrase',
    description: 'Filters by substring match in a field value',
    group: 'Match',
    defaultOperator: ':',
    ContentComponent: createStandardFilterContent(StaticOperatorLabel, TextValueInput),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${escapeQuotes(row.values[0])}` };
    },
    createInitialRow: () => ({ values: [] }),
  },
  [FILTER_TYPE.Range]: {
    label: 'Range',
    description: 'Filters by numeric range comparison',
    group: 'Match',
    defaultOperator: RANGE_OPERATORS.Gt,
    ContentComponent: createStandardFilterContent(RangeOperatorSelect, TextValueInput),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${row.operator}${row.values[0]}` };
    },
    createInitialRow: () => ({ values: [] }),
  },
  [FILTER_TYPE.Regexp]: {
    label: 'Regexp',
    description: 'Filters using regular expression patterns',
    group: 'Pattern',
    defaultOperator: REGEXP_OPERATORS.Match,
    ContentComponent: createStandardFilterContent(RegexpOperatorSelect, TextValueInput, { open: '"', close: '"' }),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${row.operator}"${escapeQuotes(row.values[0])}"` };
    },
    createInitialRow: () => ({ values: [] }),
  },
  [FILTER_TYPE.CaseInsensitive]: {
    label: 'Case-insensitive',
    description: 'Filters with case-insensitive matching',
    group: 'Pattern',
    defaultOperator: CASE_INSENSITIVE_OPERATORS.Match,
    ContentComponent: createStandardFilterContent(CaseInsensitiveOperatorSelect, TextValueInput, { open: '(', close: ')' }),
    serialize: (row) => {
      if (isFilterRowEmpty(row)) {
        return { result: '' };
      }
      return { result: `${row.fieldName}:${row.operator}(${escapeQuotes(row.values[0])})` };
    },
    createInitialRow: () => ({ values: [] }),
  },
};

export default FILTER_TYPE_CONFIG;

export const FILTER_TYPE_FLAT_ENTRIES = Object.entries(FILTER_TYPE_CONFIG)
  .map(([filterType, config]) => ({
    filterType: filterType as FilterType,
    label: config.label,
    description: config.description,
    createPatch: (): PipelineStepPatch => ({
      rows: [createFilterRow(filterType as FilterType, (config as FilterTypeDefinition).defaultOperator)],
    }),
  }));
