import { useCallback } from 'react';

import { getAllowedAppendTypes, getAllowedInsertTypes, removeInvalidSteps } from './pipelineRules';
import { STEP_CONFIG } from './stepConfig';
import {
  generateStepId,
  PIPELINE_STEP_TYPE,
  PipelineStepItem,
  PipelineStepPatch,
  PipelineStepType,
} from './types';

export const createStep = (type: PipelineStepType): PipelineStepItem => ({
  id: generateStepId(),
  type,
  ...STEP_CONFIG[type].createInitialData(),
} as PipelineStepItem);

export const createInitialSteps = (): PipelineStepItem[] => [
  createStep(PIPELINE_STEP_TYPE.Filter),
];

export const usePipelineActions = (
  steps: PipelineStepItem[],
  onStepsChange: (newSteps: PipelineStepItem[]) => void
) => {
  const addStep = useCallback((type: PipelineStepType): boolean => {
    const allowed = getAllowedAppendTypes(steps);
    if (!allowed.includes(type)) {
      return false;
    }
    onStepsChange([...steps, createStep(type)]);
    return true;
  }, [steps, onStepsChange]);

  const insertStep = useCallback((index: number, type: PipelineStepType): boolean => {
    if (index < 0 || index > steps.length) {
      return false;
    }
    const allowed = getAllowedInsertTypes(steps, index);
    if (!allowed.includes(type)) {
      return false;
    }
    const next = [...steps];
    next.splice(index, 0, createStep(type));
    onStepsChange(next);
    return true;
  }, [steps, onStepsChange]);

  const deleteStep = useCallback((id: string): void => {
    const index = steps.findIndex((s) => s.id === id);
    if (index <= 0) {
      return;
    }
    const next = [...steps];
    next.splice(index, 1);
    onStepsChange(removeInvalidSteps(next));
  }, [steps, onStepsChange]);

  const updateStep = useCallback((id: string, patch: PipelineStepPatch): void => {
    const index = steps.findIndex((s) => s.id === id);
    if (index < 0) {
      return;
    }
    const next = [...steps];
    next[index] = { ...next[index], ...patch } as PipelineStepItem;
    onStepsChange(next);
  }, [steps, onStepsChange]);

  return { addStep, insertStep, deleteStep, updateStep };
};
