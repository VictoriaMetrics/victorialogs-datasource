import { STEP_CONFIG } from './stepConfig';
import { PIPELINE_STEP_TYPE, PipelineStepItem, PipelineStepType } from './types';

/**
 * Transition rules derived from STEP_CONFIG.allowedNext.
 * Single source of truth — adding a new step type only requires updating stepConfig.ts.
 */
const TRANSITIONS: Record<PipelineStepType, PipelineStepType[]> = Object.fromEntries(
  Object.entries(STEP_CONFIG).map(([type, config]) => [type, config.allowedNext])
) as Record<PipelineStepType, PipelineStepType[]>;

/**
 * Removes steps that are invalid at their position after a deletion.
 * Walks the pipeline from the start, keeping only steps that are
 * valid successors of the previously kept step.
 *
 * Examples:
 *  - [Filter, ModifyFilter, Aggregate] -> [Filter, Aggregate]
 *    (Filter can't transition to ModifyFilter, so ModifyFilter is removed;
 *     Filter can transition to Aggregate, so it stays)
 *  - [Filter, AggregateFilter, Sort] -> [Filter, Sort]
 */
export const removeInvalidSteps = (steps: PipelineStepItem[]): PipelineStepItem[] => {
  if (steps.length === 0) {
    return steps;
  }

  const result: PipelineStepItem[] = [steps[0]];

  for (let i = 1; i < steps.length; i++) {
    const lastKept = result[result.length - 1];
    const allowed = TRANSITIONS[lastKept.type];
    if (allowed.includes(steps[i].type)) {
      result.push(steps[i]);
    }
  }

  return result;
};

const getAllowedAfter = (steps: PipelineStepItem[], index: number): PipelineStepType[] => {
  if (index < 0) {
    return [PIPELINE_STEP_TYPE.Filter, PIPELINE_STEP_TYPE.Custom];
  }
  const step = steps[index];
  if (!step) {
    return [];
  }
  return TRANSITIONS[step.type];
};

/**
 * Returns the step types that can be appended at the end of the pipeline.
 */
export const getAllowedAppendTypes = (steps: PipelineStepItem[]): PipelineStepType[] => {
  if (steps.length === 0) {
    return [PIPELINE_STEP_TYPE.Filter];
  }
  return getAllowedAfter(steps, steps.length - 1);
};

/**
 * Returns the step types that can be inserted between steps[index-1] and steps[index].
 * A type is allowed only if it can follow the previous step AND the next step can follow it.
 */
export const getAllowedInsertTypes = (
  steps: PipelineStepItem[],
  index: number
): PipelineStepType[] => {
  const allowedAfterPrev = getAllowedAfter(steps, index - 1);
  if (index >= steps.length) {
    return allowedAfterPrev;
  }
  const nextType = steps[index].type;
  const allowedBeforeNext = Object.entries(TRANSITIONS)
    .filter(([, targets]) => targets.includes(nextType))
    .map(([type]) => type as PipelineStepType);
  return allowedAfterPrev.filter((type) => allowedBeforeNext.includes(type));
};
