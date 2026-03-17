import {
  AggregateModifyStep as AggregateModifyStepType,
  AggregateStep as AggregateStepType,
  FilterStep as FilterStepType,
  LimitStep as LimitStepType,
  ModifyFilterStep,
  ModifyStep as ModifyStepType,
  PIPELINE_STEP_TYPE,
  PipelineStepItem,
} from '../types';

import { serializeAggregateModifyStep } from './serializeAggregateModifyStep';
import { serializeAggregateStep } from './serializeAggregateStep';
import { serializeFilterStep } from './serializeFilterStep';
import { serializeLimitStep } from './serializeLimitStep';
import { serializeModifyStep } from './serializeModifyStep';
import { serializeStep } from './serializePipeline';

const serializeStepPartialRows = (step: PipelineStepItem, rowIndex: number): string[] => {
  if (rowIndex <= 0) {
    return [];
  }

  switch (step.type) {
    case PIPELINE_STEP_TYPE.Filter: {
      const rows = (step as FilterStepType).rows?.slice(0, rowIndex);
      return serializeFilterStep(rows, step.id).pipes;
    }

    case PIPELINE_STEP_TYPE.ModifyFilter: {
      const rows = (step as ModifyFilterStep).rows?.slice(0, rowIndex);
      return serializeFilterStep(rows, step.id).pipes;
    }

    case PIPELINE_STEP_TYPE.Modify: {
      const rows = (step as ModifyStepType).rows?.slice(0, rowIndex);
      return serializeModifyStep(rows, step.id).pipes;
    }

    case PIPELINE_STEP_TYPE.Limit: {
      const rows = (step as LimitStepType).rows?.slice(0, rowIndex);
      return serializeLimitStep(rows, step.id).pipes;
    }

    case PIPELINE_STEP_TYPE.Aggregate: {
      const aggStep = step as AggregateStepType;
      const rows = aggStep.rows?.slice(0, rowIndex);
      return serializeAggregateStep(rows, aggStep.byFields, step.id).pipes;
    }

    case PIPELINE_STEP_TYPE.AggregateModify: {
      const rows = (step as AggregateModifyStepType).rows?.slice(0, rowIndex);
      return serializeAggregateModifyStep(rows, step.id).pipes;
    }

    default:
      return serializeStep(step).pipes;
  }
};

export const serializePartialPipeline = (
  steps: PipelineStepItem[],
  currentStepIndex: number,
  currentRowIndex?: number
): string => {
  const allPipes: string[] = [];

  for (let i = 0; i < currentStepIndex && i < steps.length; i++) {
    const { pipes } = serializeStep(steps[i]);
    allPipes.push(...pipes);
  }

  if (
    currentRowIndex !== undefined &&
    currentRowIndex > 0 &&
    currentStepIndex < steps.length
  ) {
    const partialPipes = serializeStepPartialRows(steps[currentStepIndex], currentRowIndex);
    allPipes.push(...partialPipes);
  }

  const result = allPipes.join(' | ');
  return result || '*';
};
