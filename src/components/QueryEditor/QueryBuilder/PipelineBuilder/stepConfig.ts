import { ComponentType } from 'react';

import AggregateModifyStepContent from './AggregateModifyStep/AggregateModifyStepContent';
import { AGGREGATE_MODIFY_TYPE_ENTRIES } from './AggregateModifyStep/aggregateModifyTypeConfig';
import { serializeAggregateModifyStep, serializeAggregateModifyStepPartial } from './AggregateModifyStep/serializeAggregateModifyStep';
import AggregateStepContent from './AggregateStep/AggregateStepContent';
import { AGGREGATE_TYPE_FLAT_ENTRIES } from './AggregateStep/aggregateTypeConfig';
import { serializeAggregateStep, serializeAggregateStepPartial } from './AggregateStep/serializeAggregateStep';
import CustomStepContent from './CustomStep/CustomStepContent';
import { serializeCustomStep } from './CustomStep/serializeCustomStep';
import FilterStepContent from './FilterStep/FilterStepContent';
import { FILTER_TYPE_FLAT_ENTRIES } from './FilterStep/filterTypeConfig';
import { serializeFilterStep, serializeFilterStepPartial } from './FilterStep/serializeFilterStep';
import LimitStepContent from './LimitStep/LimitStepContent';
import { LIMIT_TYPE_GROUPED_ENTRIES } from './LimitStep/limitTypeConfig';
import { serializeLimitStep, serializeLimitStepPartial } from './LimitStep/serializeLimitStep';
import ModifyStepContent from './ModifyStep/ModifyStepContent';
import { MODIFY_TYPE_GROUPED_ENTRIES } from './ModifyStep/modifyTypeConfig';
import { serializeModifyStep, serializeModifyStepPartial } from './ModifyStep/serializeModifyStep';
import SortStepContent from './SortStep/SortStepContent';
import { serializeSortStep } from './SortStep/serializeSortStep';
import { createSortField } from './SortStep/types';
import { SerializeResult } from './serialization/types';
import { StepContentProps } from './shared/types';
import { PIPELINE_STEP_TYPE, PipelineStepItem, PipelineStepPatch, PipelineStepType } from './types';

export type { StepContentProps };

export type MenuEntry = {
  key: string;
  label: string;
  description?: string;
  createPatch: () => PipelineStepPatch;
};

export type MenuGroup = {
  group: string;
  entries: MenuEntry[];
};

export type StepMenuConfig =
  | { variant: 'flat'; entries: MenuEntry[] }
  | { variant: 'grouped-nested'; groups: MenuGroup[] }
  | { variant: 'grouped-divider'; groups: MenuGroup[] };

interface StepConfig {
  label: string;
  allowedNext: PipelineStepType[];
  ContentComponent: ComponentType<StepContentProps> | null;
  createInitialData: () => PipelineStepPatch | undefined;
  serialize: (step: PipelineStepItem) => SerializeResult;
  serializePartial?: (step: PipelineStepItem, rowIndex: number) => SerializeResult;
  menuConfig?: StepMenuConfig;
}

const FILTER_FLAT_MENU_CONFIG: StepMenuConfig = {
  variant: 'flat',
  entries: FILTER_TYPE_FLAT_ENTRIES.map(({ filterType, label, description, createPatch }) => ({
    key: filterType, label, description, createPatch,
  })),
};

export const STEP_CONFIG: Record<PipelineStepType, StepConfig> = {
  [PIPELINE_STEP_TYPE.Filter]: {
    label: 'Filter',
    allowedNext: [PIPELINE_STEP_TYPE.Filter, PIPELINE_STEP_TYPE.Modify, PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: FilterStepContent,
    createInitialData: () => undefined,
    serialize: serializeFilterStep,
    serializePartial: serializeFilterStepPartial,
    menuConfig: FILTER_FLAT_MENU_CONFIG,
  },
  [PIPELINE_STEP_TYPE.Modify]: {
    label: 'Modify',
    allowedNext: [PIPELINE_STEP_TYPE.Modify, PIPELINE_STEP_TYPE.ModifyFilter, PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: ModifyStepContent,
    createInitialData: () => undefined,
    serialize: serializeModifyStep,
    serializePartial: serializeModifyStepPartial,
    menuConfig: {
      variant: 'grouped-nested',
      groups: MODIFY_TYPE_GROUPED_ENTRIES.map(({ group, entries }) => ({
        group,
        entries: entries.map(({ modifyType, label, description, createPatch }) => ({
          key: modifyType, label, description, createPatch,
        })),
      })),
    },
  },
  [PIPELINE_STEP_TYPE.ModifyFilter]: {
    label: 'Filter modified fields',
    allowedNext: [PIPELINE_STEP_TYPE.ModifyFilter, PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: FilterStepContent,
    createInitialData: () => undefined,
    serialize: serializeFilterStep,
    serializePartial: serializeFilterStepPartial,
    menuConfig: FILTER_FLAT_MENU_CONFIG,
  },
  [PIPELINE_STEP_TYPE.Aggregate]: {
    label: 'Aggregate',
    allowedNext: [PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.AggregateFilter, PIPELINE_STEP_TYPE.AggregateModify, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: AggregateStepContent,
    createInitialData: () => undefined,
    serialize: serializeAggregateStep,
    serializePartial: serializeAggregateStepPartial,
    menuConfig: {
      variant: 'flat',
      entries: AGGREGATE_TYPE_FLAT_ENTRIES.map(({ aggregateType, label, description, createPatch }) => ({
        key: aggregateType, label, description, createPatch,
      })),
    },
  },
  [PIPELINE_STEP_TYPE.AggregateFilter]: {
    label: 'Filter aggregated values',
    allowedNext: [PIPELINE_STEP_TYPE.AggregateFilter, PIPELINE_STEP_TYPE.AggregateModify, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: FilterStepContent,
    createInitialData: () => undefined,
    serialize: serializeFilterStep,
    menuConfig: FILTER_FLAT_MENU_CONFIG,
  },
  [PIPELINE_STEP_TYPE.AggregateModify]: {
    label: 'Modify aggregated values',
    allowedNext: [PIPELINE_STEP_TYPE.AggregateModify, PIPELINE_STEP_TYPE.AggregateModifyFilter, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: AggregateModifyStepContent,
    createInitialData: () => undefined,
    serialize: serializeAggregateModifyStep,
    serializePartial: serializeAggregateModifyStepPartial,
    menuConfig: {
      variant: 'flat',
      entries: AGGREGATE_MODIFY_TYPE_ENTRIES.map(({ aggregateModifyType, label, description, createPatch }) => ({
        key: aggregateModifyType, label, description, createPatch,
      })),
    },
  },
  [PIPELINE_STEP_TYPE.AggregateModifyFilter]: {
    label: 'Filter modified aggregated values',
    allowedNext: [PIPELINE_STEP_TYPE.AggregateModifyFilter, PIPELINE_STEP_TYPE.Sort, PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: FilterStepContent,
    createInitialData: () => undefined,
    serialize: serializeFilterStep,
    menuConfig: FILTER_FLAT_MENU_CONFIG,
  },
  [PIPELINE_STEP_TYPE.Sort]: {
    label: 'Sort',
    allowedNext: [PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: SortStepContent,
    createInitialData: () => ({ rows: [createSortField()] }),
    serialize: serializeSortStep,
  },
  [PIPELINE_STEP_TYPE.Limit]: {
    label: 'Limit',
    allowedNext: [PIPELINE_STEP_TYPE.Limit, PIPELINE_STEP_TYPE.Custom],
    ContentComponent: LimitStepContent,
    createInitialData: () => undefined,
    serialize: serializeLimitStep,
    serializePartial: serializeLimitStepPartial,
    menuConfig: {
      variant: 'grouped-divider',
      groups: LIMIT_TYPE_GROUPED_ENTRIES.map(({ group, entries }) => ({
        group,
        entries: entries.map(({ limitType, label, description, createPatch }) => ({
          key: limitType, label, description, createPatch,
        })),
      })),
    },
  },
  [PIPELINE_STEP_TYPE.Custom]: {
    label: 'Custom',
    allowedNext: [
      PIPELINE_STEP_TYPE.Filter,
      PIPELINE_STEP_TYPE.Modify,
      PIPELINE_STEP_TYPE.ModifyFilter,
      PIPELINE_STEP_TYPE.Aggregate,
      PIPELINE_STEP_TYPE.AggregateFilter,
      PIPELINE_STEP_TYPE.AggregateModify,
      PIPELINE_STEP_TYPE.AggregateModifyFilter,
      PIPELINE_STEP_TYPE.Sort,
      PIPELINE_STEP_TYPE.Limit,
      PIPELINE_STEP_TYPE.Custom,
    ],
    ContentComponent: CustomStepContent,
    createInitialData: () => ({ expression: '' }),
    serialize: serializeCustomStep,
  },
};
