import {
  AggregateFilterStep,
  AggregateModifyFilterStep,
  AggregateModifyStep as AggregateModifyStepType,
  AggregateStep as AggregateStepType,
  FilterStep as FilterStepType,
  LimitStep as LimitStepType,
  ModifyFilterStep,
  ModifyStep as ModifyStepType,
  PIPELINE_STEP_TYPE,
  PipelineStepItem,
  SortStep as SortStepType,
} from '../types';

import { serializeAggregateModifyStep } from './serializeAggregateModifyStep';
import { serializeAggregateStep } from './serializeAggregateStep';
import { serializeFilterStep } from './serializeFilterStep';
import { serializeLimitStep } from './serializeLimitStep';
import { serializeModifyStep } from './serializeModifyStep';
import { serializeSortStep } from './serializeSortStep';
import { SerializeResult } from './types';

const serializeStep = (step: PipelineStepItem): SerializeResult => {
  switch (step.type) {
    case PIPELINE_STEP_TYPE.Filter:
      return serializeFilterStep((step as FilterStepType).rows, step.id);

    case PIPELINE_STEP_TYPE.ModifyFilter:
      return serializeFilterStep((step as ModifyFilterStep).rows, step.id);

    case PIPELINE_STEP_TYPE.Modify:
      return serializeModifyStep((step as ModifyStepType).rows, step.id);

    case PIPELINE_STEP_TYPE.Aggregate: {
      const aggStep = step as AggregateStepType;
      return serializeAggregateStep(aggStep.rows, aggStep.byFields, step.id);
    }

    case PIPELINE_STEP_TYPE.AggregateFilter: {
      const condition = (step as AggregateFilterStep).condition;
      if (!condition) {
        return { pipes: [] };
      }
      return { pipes: [`filter ${condition}`] };
    }

    case PIPELINE_STEP_TYPE.AggregateModify:
      return serializeAggregateModifyStep((step as AggregateModifyStepType).rows, step.id);

    case PIPELINE_STEP_TYPE.AggregateModifyFilter: {
      const condition = (step as AggregateModifyFilterStep).condition;
      if (!condition) {
        return { pipes: [] };
      }
      return { pipes: [`filter ${condition}`] };
    }

    case PIPELINE_STEP_TYPE.Sort:
      return serializeSortStep(step as SortStepType);

    case PIPELINE_STEP_TYPE.Limit:
      return serializeLimitStep((step as LimitStepType).rows, step.id);

    default:
      return { pipes: [] };
  }
};

export const serializePipeline = (steps: PipelineStepItem[]): string => {
  if (!steps.length) {
    return '';
  }

  const allPipes: string[] = [];

  for (const step of steps) {
    const { pipes } = serializeStep(step);

    allPipes.push(...pipes);

    if (step.customPipes?.length) {
      allPipes.push(...step.customPipes);
    }
  }

  return allPipes.join(' | ');
};
