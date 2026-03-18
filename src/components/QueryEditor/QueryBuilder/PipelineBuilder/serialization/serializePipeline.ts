import { STEP_CONFIG } from '../stepConfig';
import { PipelineStepItem } from '../types';

import { SerializeResult } from './types';

export const serializeStep = (step: PipelineStepItem): SerializeResult => {
  const config = STEP_CONFIG[step.type];
  return config.serialize(step);
};

export const serializePipeline = (steps: PipelineStepItem[]): string => {
  if (!steps.length) {
    return '';
  }

  const allPipes: string[] = [];

  for (const step of steps) {
    const { pipes } = serializeStep(step);
    allPipes.push(...pipes);
  }

  return allPipes.join(' | ');
};
