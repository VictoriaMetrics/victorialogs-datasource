import { STEP_CONFIG } from '../stepConfig';
import { PIPELINE_STEP_TYPE, PipelineStepItem } from '../types';

import { SerializeResult } from './types';

export const serializeStep = (step: PipelineStepItem): SerializeResult => {
  const config = STEP_CONFIG[step.type];
  return config.serialize(step);
};

interface SerializeOptions {
  /**
   * When true, prepends `*` if the first step is not a filter.
   * Used in Builder mode where stream filters are sent separately and the
   * pipeline expression needs an explicit "match all" entry point.
   * Not needed in Code mode where stream filters precede the pipeline in the expression.
   */
  prependStar?: boolean;
}

export const serializePipeline = (steps: PipelineStepItem[], options: SerializeOptions = {}): string => {
  if (!steps.length) {
    return '';
  }

  const { prependStar = false } = options;

  const allPipes: string[] = [];

  if (prependStar && steps[0].type !== PIPELINE_STEP_TYPE.Filter) {
    allPipes.push('*');
  }

  for (const step of steps) {
    const { pipes } = serializeStep(step);
    allPipes.push(...pipes);
  }

  return allPipes.join(' | ');
};
