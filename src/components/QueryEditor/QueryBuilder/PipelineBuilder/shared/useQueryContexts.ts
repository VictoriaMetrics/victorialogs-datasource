import { useMemo } from 'react';

import { buildQueryContexts } from '../serialization/serializePartialPipeline';
import { PipelineStepItem } from '../types';

/**
 * Pre-computes memoized queryContext strings for every row in the current step.
 * Previous steps are serialized only once per render (not once per row).
 */
export const useQueryContexts = (
  steps: PipelineStepItem[],
  currentStepIndex: number,
  rowCount: number
): string[] => {
  return useMemo(
    () => buildQueryContexts(steps, currentStepIndex, rowCount),
    [steps, currentStepIndex, rowCount]
  );
};
