import { SerializeResult } from '../serialization/types';
import { LimitStep as LimitStepType, PipelineStepItem } from '../types';

import LIMIT_TYPE_CONFIG from './limitTypeConfig';
import { LimitRow } from './types';

export const serializeLimitRows = (rows: LimitRow[] | undefined, stepId: string): SerializeResult => {
  if (!rows?.length) {
    return { pipes: [] };
  }

  const pipes: string[] = [];

  for (const row of rows) {
    const config = LIMIT_TYPE_CONFIG[row.limitType];
    const { result } = config.serialize(row, stepId);
    if (result) {
      pipes.push(result);
    }
  }

  return { pipes };
};

export const serializeLimitStep = (step: PipelineStepItem): SerializeResult => {
  const limitStep = step as LimitStepType;
  return serializeLimitRows(limitStep.rows, step.id);
};

export const serializeLimitStepPartial = (step: PipelineStepItem, rowIndex: number): SerializeResult => {
  const limitStep = step as LimitStepType;
  const rows = limitStep.rows?.slice(0, rowIndex);
  return serializeLimitRows(rows, step.id);
};
