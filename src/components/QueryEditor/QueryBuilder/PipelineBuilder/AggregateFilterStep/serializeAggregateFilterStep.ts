import { SerializeResult } from '../serialization/types';
import { AggregateFilterStep, AggregateModifyFilterStep, PipelineStepItem } from '../types';

export const serializeConditionStep = (step: PipelineStepItem): SerializeResult => {
  const condition = (step as AggregateFilterStep | AggregateModifyFilterStep).condition;
  if (!condition) {
    return { pipes: [] };
  }
  return { pipes: [`filter ${condition}`] };
};
