import { useCallback, useState } from 'react';

import { getAllowedAppendTypes, getAllowedInsertTypes, removeInvalidSteps } from './pipelineRules';
import { STEP_CONFIG } from './stepConfig';
import {
  generateStepId,
  PIPELINE_STEP_TYPE,
  PipelineStepItem,
  PipelineStepPatch,
  PipelineStepType,
} from './types';

const createStep = (type: PipelineStepType): PipelineStepItem => ({
  id: generateStepId(),
  type,
  ...STEP_CONFIG[type].createInitialData(),
} as PipelineStepItem);

const createInitialSteps = (): PipelineStepItem[] => [
  createStep(PIPELINE_STEP_TYPE.Filter),
];

export const usePipelineState = () => {
  const [steps, setSteps] = useState<PipelineStepItem[]>(createInitialSteps);

  /**
   * Append a new step at the end of the pipeline.
   * Returns false if the step type is not allowed at the end.
   */
  const addStep = useCallback((type: PipelineStepType): boolean => {
    let added = false;
    setSteps((prev) => {
      const allowed = getAllowedAppendTypes(prev);
      if (!allowed.includes(type)) {
        return prev;
      }
      added = true;
      return [...prev, createStep(type)];
    });
    return added;
  }, []);

  /**
   * Insert a new step at the given index.
   * Existing steps at `index` and beyond shift right.
   * Returns false if the step type is not allowed at that position.
   */
  const insertStep = useCallback((index: number, type: PipelineStepType): boolean => {
    let inserted = false;
    setSteps((prev) => {
      if (index < 0 || index > prev.length) {
        return prev;
      }
      const allowed = getAllowedInsertTypes(prev, index);
      if (!allowed.includes(type)) {
        return prev;
      }
      inserted = true;
      const next = [...prev];
      next.splice(index, 0, createStep(type));
      return next;
    });
    return inserted;
  }, []);

  /**
   * Delete a step by its ID.
   * The first Filter step (index 0) cannot be deleted.
   * Steps that become invalid after deletion are removed.
   */
  const deleteStep = useCallback((id: string): void => {
    setSteps((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index <= 0) {
        return prev;
      }
      const next = [...prev];
      next.splice(index, 1);
      return removeInvalidSteps(next);
    });
  }, []);

  /**
   * Update a step in-place by its ID.
   * Accepts a partial update that is merged into the existing step.
   */
  const updateStep = useCallback((id: string, patch: PipelineStepPatch): void => {
    setSteps((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index < 0) {
        return prev;
      }
      const next = [...prev];
      next[index] = { ...next[index], ...patch } as PipelineStepItem;
      return next;
    });
  }, []);

  return {
    steps,
    addStep,
    insertStep,
    deleteStep,
    updateStep,
  };
};
