import { AggregateModifyRow } from './AggregateModifyStep/types';
import { AggregateRow } from './AggregateStep/types';
import { FilterRow } from './FilterStep/types';
import { LimitRow } from './LimitStep/types';
import { ModifyRow } from './ModifyStep/types';
import { SortField } from './SortStep/types';

export const PIPELINE_STEP_TYPE = {
  Filter: 'filter',
  Modify: 'modify',
  ModifyFilter: 'modifyFilter',
  Aggregate: 'aggregate',
  AggregateFilter: 'aggregateFilter',
  AggregateModify: 'aggregateModify',
  Sort: 'sort',
  Limit: 'limit',
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
  aggregateModifyRows?: AggregateModifyRow[];
  limitRows?: LimitRow[];
  sortFields?: SortField[];
  sortOffset?: string;
  sortLimit?: string;
  sortPartitionByFields?: string[];
  sortRankField?: string;
}

let stepIdCounter = 0;

export const generateStepId = (): string => {
  stepIdCounter += 1;
  return `step-${Date.now()}-${stepIdCounter}`;
};
