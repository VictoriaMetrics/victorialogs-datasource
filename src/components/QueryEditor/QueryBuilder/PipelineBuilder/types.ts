import { AggregateRow } from './AggregateStep/types';
import { FilterRow } from './FilterStep/types';
import { ModifyRow } from './ModifyStep/types';

export const PIPELINE_STEP_TYPE = {
  Filter: 'filter',
  Modify: 'modify',
  ModifyFilter: 'modifyFilter',
  Aggregate: 'aggregate',
  AggregateFilter: 'aggregateFilter',
  Sort: 'sort',
} as const;

export type PipelineStepType = (typeof PIPELINE_STEP_TYPE)[keyof typeof PIPELINE_STEP_TYPE];

export interface PipelineStepItem {
  id: string;
  type: PipelineStepType;
  filterRows?: FilterRow[];
  modifyRows?: ModifyRow[];
  aggregateRows?: AggregateRow[];
  aggregateByFields?: string[];
  aggregateFilterCondition?: string;
}

let stepIdCounter = 0;

export const generateStepId = (): string => {
  stepIdCounter += 1;
  return `step-${Date.now()}-${stepIdCounter}`;
};
