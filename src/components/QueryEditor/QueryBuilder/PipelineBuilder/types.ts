export const PIPELINE_STEP_TYPE = {
  Filter: 'filter',
  Modify: 'modify',
  ModifyFilter: 'modifyFilter',
  Aggregate: 'aggregate',
  AggregateFilter: 'aggregateFilter',
  Sort: 'sort',
} as const;

export type PipelineStepType = (typeof PIPELINE_STEP_TYPE)[keyof typeof PIPELINE_STEP_TYPE];

export const STEP_TYPE_LABELS: Record<PipelineStepType, string> = {
  [PIPELINE_STEP_TYPE.Filter]: 'Filter',
  [PIPELINE_STEP_TYPE.Modify]: 'Modify',
  [PIPELINE_STEP_TYPE.ModifyFilter]: 'Filter modified fields',
  [PIPELINE_STEP_TYPE.Aggregate]: 'Aggregate',
  [PIPELINE_STEP_TYPE.AggregateFilter]: 'Filter aggregated values',
  [PIPELINE_STEP_TYPE.Sort]: 'Sort',
};

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

export interface FilterRow {
  id: string;
  filterType: FilterType;
  fieldName: string;
  operator: string;
  values: string[];
}

export const createFilterRow = (filterType: FilterType, defaultOperator: string): FilterRow => ({
  id: generateFilterRowId(),
  filterType,
  fieldName: '',
  operator: defaultOperator,
  values: [],
});

let filterRowIdCounter = 0;

export const generateFilterRowId = (): string => {
  filterRowIdCounter += 1;
  return `filter-row-${Date.now()}-${filterRowIdCounter}`;
};

export interface PipelineStepItem {
  id: string;
  type: PipelineStepType;
  filterRows?: FilterRow[];
}

let stepIdCounter = 0;

export const generateStepId = (): string => {
  stepIdCounter += 1;
  return `step-${Date.now()}-${stepIdCounter}`;
};
