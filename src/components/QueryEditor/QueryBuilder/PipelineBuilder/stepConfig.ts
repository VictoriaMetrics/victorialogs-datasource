import { ComponentType } from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';

import AggregateFilterStepContent from './AggregateFilterStep/AggregateFilterStepContent';
import AggregateModifyStepContent from './AggregateModifyStep/AggregateModifyStepContent';
import AggregateStepContent from './AggregateStep/AggregateStepContent';
import FilterStepContent from './FilterStep/FilterStepContent';
import { createFilterRow, FILTER_TYPE } from './FilterStep/types';
import LimitStepContent from './LimitStep/LimitStepContent';
import { createLimitRow, LIMIT_TYPE } from './LimitStep/types';
import ModifyStepContent from './ModifyStep/ModifyStepContent';
import SortStepContent from './SortStep/SortStepContent';
import { createSortField } from './SortStep/types';
import { PIPELINE_STEP_TYPE, PipelineStepItem, PipelineStepPatch, PipelineStepType } from './types';

export interface StepContentProps {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
}

interface StepConfig {
  label: string;
  ContentComponent: ComponentType<StepContentProps> | null;
  createInitialData: () => PipelineStepPatch | undefined;
}

const createFilterInitialData = (): PipelineStepPatch => ({ rows: [createFilterRow(FILTER_TYPE.Exact, 'in')] });

export const STEP_CONFIG: Record<PipelineStepType, StepConfig> = {
  [PIPELINE_STEP_TYPE.Filter]: {
    label: 'Filter',
    ContentComponent: FilterStepContent,
    createInitialData: createFilterInitialData,
  },
  [PIPELINE_STEP_TYPE.Modify]: {
    label: 'Modify',
    ContentComponent: ModifyStepContent,
    createInitialData: () => undefined,
  },
  [PIPELINE_STEP_TYPE.ModifyFilter]: {
    label: 'Filter modified fields',
    ContentComponent: FilterStepContent,
    createInitialData: createFilterInitialData,
  },
  [PIPELINE_STEP_TYPE.Aggregate]: {
    label: 'Aggregate',
    ContentComponent: AggregateStepContent,
    createInitialData: () => undefined,
  },
  [PIPELINE_STEP_TYPE.AggregateFilter]: {
    label: 'Filter aggregated values',
    ContentComponent: AggregateFilterStepContent,
    createInitialData: () => undefined,
  },
  [PIPELINE_STEP_TYPE.AggregateModify]: {
    label: 'Modify aggregated values',
    ContentComponent: AggregateModifyStepContent,
    createInitialData: () => undefined,
  },
  [PIPELINE_STEP_TYPE.Sort]: {
    label: 'Sort',
    ContentComponent: SortStepContent,
    createInitialData: () => ({ rows: [createSortField()] }),
  },
  [PIPELINE_STEP_TYPE.Limit]: {
    label: 'Limit',
    ContentComponent: LimitStepContent,
    createInitialData: () => ({ rows: [createLimitRow(LIMIT_TYPE.Limit)] }),
  },
};
