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
