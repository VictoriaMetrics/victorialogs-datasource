import { ComponentType } from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';

import AggregateFilterStepContent from './AggregateFilterStep/AggregateFilterStepContent';
import AggregateStepContent from './AggregateStep/AggregateStepContent';
import FilterStepContent from './FilterStep/FilterStepContent';
import { createFilterRow, FILTER_TYPE } from './FilterStep/types';
import ModifyStepContent from './ModifyStep/ModifyStepContent';
import { PIPELINE_STEP_TYPE, PipelineStepItem, PipelineStepType } from './types';

export interface StepContentProps {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: Partial<Omit<PipelineStepItem, 'id' | 'type'>>) => void;
}

interface StepConfig {
  label: string;
  ContentComponent: ComponentType<StepContentProps> | null;
  createInitialData: () => Partial<Omit<PipelineStepItem, 'id' | 'type'>> | undefined;
}

const createFilterInitialData = () => ({ filterRows: [createFilterRow(FILTER_TYPE.Exact, 'in')] });

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
  [PIPELINE_STEP_TYPE.Sort]: {
    label: 'Sort',
    ContentComponent: null,
    createInitialData: () => undefined,
  },
};
