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
 * Precomputed reverse mapping: for each step type, which types can precede it.
 */
const REVERSE_TRANSITIONS: Partial<Record<PipelineStepType, PipelineStepType[]>> = {};
for (const [sourceType, targets] of Object.entries(TRANSITIONS)) {
  for (const target of targets) {
    (REVERSE_TRANSITIONS[target] ??= []).push(sourceType as PipelineStepType);
  }
}

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
 * Uses precomputed REVERSE_TRANSITIONS for O(1) lookup.
 */
const getAllowedBefore = (steps: PipelineStepItem[], index: number): PipelineStepType[] => {
  const step = steps[index];
  if (!step) {
    return Object.values(PIPELINE_STEP_TYPE);
  }
  return REVERSE_TRANSITIONS[step.type] ?? [];
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
