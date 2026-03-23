import { ComponentType } from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';

import AggregateModifyStepContent from './AggregateModifyStep/AggregateModifyStepContent';
import { serializeAggregateModifyStep, serializeAggregateModifyStepPartial } from './AggregateModifyStep/serializeAggregateModifyStep';
import AggregateStepContent from './AggregateStep/AggregateStepContent';
import { serializeAggregateStep, serializeAggregateStepPartial } from './AggregateStep/serializeAggregateStep';
import FilterStepContent from './FilterStep/FilterStepContent';
import { serializeFilterStep, serializeFilterStepPartial } from './FilterStep/serializeFilterStep';
import LimitStepContent from './LimitStep/LimitStepContent';
import { serializeLimitStep, serializeLimitStepPartial } from './LimitStep/serializeLimitStep';
import ModifyStepContent from './ModifyStep/ModifyStepContent';
import { serializeModifyStep, serializeModifyStepPartial } from './ModifyStep/serializeModifyStep';
import SortStepContent from './SortStep/SortStepContent';
import { serializeSortStep } from './SortStep/serializeSortStep';
import { createSortField } from './SortStep/types';
import { SerializeResult } from './serialization/types';
import { PIPELINE_STEP_TYPE, PipelineStepItem, PipelineStepPatch, PipelineStepType } from './types';

export interface StepContentProps {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  onDeleteStep: (id: string) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

interface StepConfig {
  label: string;
  allowedNext: PipelineStepType[];
  ContentComponent: ComponentType<StepContentProps> | null;
  createInitialData: () => PipelineStepPatch | undefined;
  serialize: (step: PipelineStepItem) => SerializeResult;
  serializePartial?: (step: PipelineStepItem, rowIndex: number) => SerializeResult;
}

export const STEP_CONFIG: Record<PipelineStepType, StepConfig> = {
  [PIPELINE_STEP_TYPE.Filter]: {
    label: 'Filter',
    allowedNext: [PIPELINE_STEP_TYPE.Filter, PIPELINE_STEP_TYPE.Modify, PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit],
    ContentComponent: FilterStepContent,
    createInitialData: () => undefined,
    serialize: serializeFilterStep,
    serializePartial: serializeFilterStepPartial,
  },
  [PIPELINE_STEP_TYPE.Modify]: {
    label: 'Modify',
    allowedNext: [PIPELINE_STEP_TYPE.Modify, PIPELINE_STEP_TYPE.ModifyFilter, PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit],
    ContentComponent: ModifyStepContent,
    createInitialData: () => undefined,
    serialize: serializeModifyStep,
    serializePartial: serializeModifyStepPartial,
  },
  [PIPELINE_STEP_TYPE.ModifyFilter]: {
    label: 'Filter modified fields',
    allowedNext: [PIPELINE_STEP_TYPE.ModifyFilter, PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit],
    ContentComponent: FilterStepContent,
    createInitialData: () => undefined,
    serialize: serializeFilterStep,
    serializePartial: serializeFilterStepPartial,
  },
  [PIPELINE_STEP_TYPE.Aggregate]: {
    label: 'Aggregate',
    allowedNext: [PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.AggregateFilter, PIPELINE_STEP_TYPE.AggregateModify, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit],
    ContentComponent: AggregateStepContent,
    createInitialData: () => undefined,
    serialize: serializeAggregateStep,
    serializePartial: serializeAggregateStepPartial,
  },
  [PIPELINE_STEP_TYPE.AggregateFilter]: {
    label: 'Filter aggregated values',
    allowedNext: [PIPELINE_STEP_TYPE.AggregateFilter, PIPELINE_STEP_TYPE.AggregateModify, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit],
    ContentComponent: FilterStepContent,
    createInitialData: () => undefined,
    serialize: serializeFilterStep,
  },
  [PIPELINE_STEP_TYPE.AggregateModify]: {
    label: 'Modify aggregated values',
    allowedNext: [PIPELINE_STEP_TYPE.AggregateModify, PIPELINE_STEP_TYPE.AggregateModifyFilter, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit],
    ContentComponent: AggregateModifyStepContent,
    createInitialData: () => undefined,
    serialize: serializeAggregateModifyStep,
    serializePartial: serializeAggregateModifyStepPartial,
  },
  [PIPELINE_STEP_TYPE.AggregateModifyFilter]: {
    label: 'Filter modified aggregated values',
    allowedNext: [PIPELINE_STEP_TYPE.AggregateModifyFilter, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit],
    ContentComponent: FilterStepContent,
    createInitialData: () => undefined,
    serialize: serializeFilterStep,
  },
  [PIPELINE_STEP_TYPE.Sort]: {
    label: 'Sort',
    allowedNext: [PIPELINE_STEP_TYPE.Limit],
    ContentComponent: SortStepContent,
    createInitialData: () => ({ rows: [createSortField()] }),
    serialize: serializeSortStep,
  },
  [PIPELINE_STEP_TYPE.Limit]: {
    label: 'Limit',
    allowedNext: [PIPELINE_STEP_TYPE.Limit],
    ContentComponent: LimitStepContent,
    createInitialData: () => undefined,
    serialize: serializeLimitStep,
    serializePartial: serializeLimitStepPartial,
  },
};
