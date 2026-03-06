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

export interface PipelineStepItem {
  id: string;
  type: PipelineStepType;
}

let stepIdCounter = 0;

export const generateStepId = (): string => {
  stepIdCounter += 1;
  return `step-${Date.now()}-${stepIdCounter}`;
};
