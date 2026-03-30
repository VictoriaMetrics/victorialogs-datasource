import { FILTER_TYPE } from '../FilterStep/types';
import { PIPELINE_STEP_TYPE, PipelineStepItem } from '../types';

export const isLastFilterAllStep = (steps: PipelineStepItem[]) => {
  const lastStep = steps[steps.length - 1];
  if (lastStep && lastStep.type === PIPELINE_STEP_TYPE.Filter && lastStep.rows[0].filterType === FILTER_TYPE.All) {
    return true;
  }
  return false;
};
