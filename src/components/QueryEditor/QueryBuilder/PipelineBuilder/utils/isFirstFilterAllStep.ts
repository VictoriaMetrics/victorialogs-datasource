import { FILTER_TYPE } from '../FilterStep/types';
import { FilterStep, PIPELINE_STEP_TYPE, PipelineStepItem } from '../types';

/**
 * Returns true if the step at the given index is the first Filter step with a single "All" row.
 */
export const isFirstFilterAllStep = (steps: PipelineStepItem[], stepIndex: number): boolean => {
  if (stepIndex !== 0) {
    return false;
  }
  const step = steps[0];
  if (step.type !== PIPELINE_STEP_TYPE.Filter) {
    return false;
  }
  const filterStep = step as FilterStep;
  return filterStep.rows.length === 1 && filterStep.rows[0].filterType === FILTER_TYPE.All;
};
