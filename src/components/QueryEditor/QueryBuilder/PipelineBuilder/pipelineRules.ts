import { PIPELINE_STEP_TYPE, PipelineStepItem, PipelineStepType } from './types';

/**
 * Transition rules define which step types are allowed after a given step type.
 */
const TRANSITIONS: Record<PipelineStepType, PipelineStepType[]> = {
  [PIPELINE_STEP_TYPE.Filter]: [PIPELINE_STEP_TYPE.Modify, PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort],
  [PIPELINE_STEP_TYPE.Modify]: [PIPELINE_STEP_TYPE.ModifyFilter, PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort],
  [PIPELINE_STEP_TYPE.ModifyFilter]: [PIPELINE_STEP_TYPE.Aggregate, PIPELINE_STEP_TYPE.Sort],
  [PIPELINE_STEP_TYPE.Aggregate]: [PIPELINE_STEP_TYPE.AggregateFilter, PIPELINE_STEP_TYPE.Sort],
  [PIPELINE_STEP_TYPE.AggregateFilter]: [PIPELINE_STEP_TYPE.Sort],
  [PIPELINE_STEP_TYPE.Sort]: [],
};

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
    return [PIPELINE_STEP_TYPE.Filter];
  }
  const step = steps[index];
  if (!step) {
    return [];
  }
  return TRANSITIONS[step.type];
};

/**
 * Returns the set of step types that can precede the step at the given index.
 * This is the inverse lookup: which step types list steps[index].type in their transitions?
 */
const getAllowedBefore = (steps: PipelineStepItem[], index: number): PipelineStepType[] => {
  const step = steps[index];
  if (!step) {
    return Object.values(PIPELINE_STEP_TYPE);
  }
  const targetType = step.type;
  const allowed: PipelineStepType[] = [];

  for (const [sourceType, targets] of Object.entries(TRANSITIONS)) {
    if (targets.includes(targetType)) {
      allowed.push(sourceType as PipelineStepType);
    }
  }

  return allowed;
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
 * Returns the step types that can be inserted at a given position (before the step
 * currently at that index). The inserted step must be a valid successor of the step
 * before it AND a valid predecessor of the step after it.
 *
 * @param steps   Current pipeline
 * @param index   Position where the new step will be inserted (0-based).
 *                Existing steps at index and beyond shift right.
 */
export const getAllowedInsertTypes = (steps: PipelineStepItem[], index: number): PipelineStepType[] => {
  // What can follow the step before the insertion point?
  const allowedAfterPrev = getAllowedAfter(steps, index - 1);

  // What can precede the step currently at the insertion point?
  const allowedBeforeNext = index < steps.length ? getAllowedBefore(steps, index) : Object.values(PIPELINE_STEP_TYPE);

  // Intersection: the new step must satisfy both constraints
  return allowedAfterPrev.filter((type) => allowedBeforeNext.includes(type));
};
