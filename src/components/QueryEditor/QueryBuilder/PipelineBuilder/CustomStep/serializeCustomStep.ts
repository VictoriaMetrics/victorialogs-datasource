import { SerializeResult } from '../serialization/types';
import { CustomStep, PipelineStepItem } from '../types';

export const serializeCustomStep = (step: PipelineStepItem): SerializeResult => {
  const customStep = step as CustomStep;
  return { pipes: customStep.expression ? [customStep.expression] : [] };
};
