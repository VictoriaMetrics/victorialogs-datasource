import { useCallback } from 'react';

import { FILTER_TYPE, createFilterRow } from './FilterStep/types';
import { getAllowedAppendTypes, getAllowedInsertTypes, removeInvalidSteps } from './pipelineRules';
import { STEP_CONFIG } from './stepConfig';
import {
  PIPELINE_STEP_TYPE,
  generateStepId,
  PipelineStepItem,
  PipelineStepPatch,
  PipelineStepType,
} from './types';
import { isFirstFilterAllStep } from './utils/isFirstFilterAllStep';
import { isLastFilterAllStep } from './utils/isLastFilterAllStep';

export const createStep = (type: PipelineStepType): PipelineStepItem => ({
  id: generateStepId(),
  type,
  ...STEP_CONFIG[type].createInitialData(),
} as PipelineStepItem);

export const createInitialSteps = (): PipelineStepItem[] => [
  {
    id: generateStepId(),
    type: PIPELINE_STEP_TYPE.Filter,
    rows: [createFilterRow(FILTER_TYPE.All)],
  } as PipelineStepItem,
];

export const usePipelineActions = (
  steps: PipelineStepItem[],
  onStepsChange: (newSteps: PipelineStepItem[]) => void
) => {
  const addStep = useCallback((type: PipelineStepType, initialPatch?: PipelineStepPatch): boolean => {
    const allowed = getAllowedAppendTypes(steps);
    if (!allowed.includes(type)) {
      return false;
    }

    let newSteps = [...steps];
    // remove the last filter step if it's an ALL filter, and we're adding another filter step
    if (type === PIPELINE_STEP_TYPE.Filter && isLastFilterAllStep(steps)) {
      newSteps = newSteps.slice(0, -1);
    }

    const step = createStep(type);
    newSteps.push(initialPatch ? { ...step, ...initialPatch } as PipelineStepItem : step);
    onStepsChange(newSteps);
    return true;
  }, [steps, onStepsChange]);

  const deleteStep = useCallback((id: string): void => {
    const index = steps.findIndex((s) => s.id === id);
    if (index < 0) {
      return;
    }
    if (isFirstFilterAllStep(steps, index)) {
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

  const insertStep = useCallback((index: number, type: PipelineStepType, initialPatch?: PipelineStepPatch): boolean => {
    if (index < 0 || index > steps.length) {
      return false;
    }
    const allowed = getAllowedInsertTypes(steps, index);
    if (!allowed.includes(type)) {
      return false;
    }
    const step = createStep(type);
    const next = [...steps];
    next.splice(index, 0, initialPatch ? { ...step, ...initialPatch } as PipelineStepItem : step);
    onStepsChange(next);
    return true;
  }, [steps, onStepsChange]);

  return { addStep, deleteStep, updateStep, insertStep };
};
