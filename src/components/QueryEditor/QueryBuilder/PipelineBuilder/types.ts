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
  AggregateModifyFilter: 'aggregateModifyFilter',
  Sort: 'sort',
  Limit: 'limit',
  Custom: 'custom',
} as const;

export type PipelineStepType = (typeof PIPELINE_STEP_TYPE)[keyof typeof PIPELINE_STEP_TYPE];

interface BaseStep {
  id: string;
}

export interface FilterStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.Filter;
  rows: FilterRow[];
}

export interface ModifyStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.Modify;
  rows: ModifyRow[];
}

export interface ModifyFilterStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.ModifyFilter;
  rows: FilterRow[];
}

export interface AggregateStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.Aggregate;
  rows: AggregateRow[];
  byFields?: string[];
}

export interface AggregateFilterStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.AggregateFilter;
  rows: FilterRow[];
}

export interface AggregateModifyStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.AggregateModify;
  rows: AggregateModifyRow[];
}

export interface AggregateModifyFilterStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.AggregateModifyFilter;
  rows: FilterRow[];
}

export interface SortStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.Sort;
  rows: SortField[];
  offset?: string;
  limit?: string;
  partitionByFields?: string[];
  rankField?: string;
}

export interface LimitStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.Limit;
  rows: LimitRow[];
}

export interface CustomStep extends BaseStep {
  type: typeof PIPELINE_STEP_TYPE.Custom;
  expression: string;
}

export type PipelineStepItem =
  | FilterStep
  | ModifyStep
  | ModifyFilterStep
  | AggregateStep
  | AggregateFilterStep
  | AggregateModifyStep
  | AggregateModifyFilterStep
  | SortStep
  | LimitStep
  | CustomStep;

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type PipelineStepPatch = Partial<DistributiveOmit<PipelineStepItem, 'id' | 'type'>>;

let stepIdCounter = 0;

export const generateStepId = (): string => {
  stepIdCounter += 1;
  return `step-${Date.now()}-${stepIdCounter}`;
};
