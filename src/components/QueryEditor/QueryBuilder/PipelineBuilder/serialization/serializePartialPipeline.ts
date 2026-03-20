import { STEP_CONFIG } from '../stepConfig';
import { PipelineStepItem } from '../types';

import { serializeStep } from './serializePipeline';

const serializeStepPartialRows = (step: PipelineStepItem, rowIndex: number): string[] => {
  if (rowIndex <= 0) {
    return [];
  }

  const config = STEP_CONFIG[step.type];
  if (config.serializePartial) {
    return config.serializePartial(step, rowIndex).pipes;
  }

  return serializeStep(step).pipes;
};

const serializePreviousSteps = (steps: PipelineStepItem[], currentStepIndex: number): string[] => {
  const pipes: string[] = [];
  for (let i = 0; i < currentStepIndex && i < steps.length; i++) {
    pipes.push(...serializeStep(steps[i]).pipes);
  }
  return pipes;
};

const pipesToString = (pipes: string[]): string => pipes.join(' | ') || '*';

export const serializePartialPipeline = (
  steps: PipelineStepItem[],
  currentStepIndex: number,
  currentRowIndex?: number
): string => {
  const prefixPipes = serializePreviousSteps(steps, currentStepIndex);

  if (
    currentRowIndex !== undefined &&
    currentRowIndex > 0 &&
    currentStepIndex < steps.length
  ) {
    const partialPipes = serializeStepPartialRows(steps[currentStepIndex], currentRowIndex);
    return pipesToString([...prefixPipes, ...partialPipes]);
  }

  return pipesToString(prefixPipes);
};

/**
 * Pre-computes queryContext strings for every row in the current step.
 * Serializes previous steps only once, then incrementally builds per-row contexts.
 */
export const buildQueryContexts = (
  steps: PipelineStepItem[],
  currentStepIndex: number,
  rowCount: number
): string[] => {
  const prefixPipes = serializePreviousSteps(steps, currentStepIndex);
  const prefix = pipesToString(prefixPipes);

  const contexts: string[] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    if (rowIndex === 0 || currentStepIndex >= steps.length) {
      contexts.push(prefix);
    } else {
      const partialPipes = serializeStepPartialRows(steps[currentStepIndex], rowIndex);
      contexts.push(pipesToString([...prefixPipes, ...partialPipes]));
    }
  }
  return contexts;
};
