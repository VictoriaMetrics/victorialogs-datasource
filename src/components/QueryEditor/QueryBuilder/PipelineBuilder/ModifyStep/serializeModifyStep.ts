import { SerializeResult } from '../serialization/types';
import { ModifyStep as ModifyStepType, PipelineStepItem } from '../types';

import MODIFY_TYPE_CONFIG from './modifyTypeConfig';
import { ModifyRow } from './types';

export const serializeModifyRows = (rows: ModifyRow[] | undefined, stepId: string): SerializeResult => {
  if (!rows?.length) {
    return { pipes: [] };
  }

  const pipes: string[] = [];

  for (const row of rows) {
    const config = MODIFY_TYPE_CONFIG[row.modifyType];
    const { result } = config.serialize(row, stepId);
    if (result) {
      pipes.push(result);
    }
  }

  return { pipes };
};

export const serializeModifyStep = (step: PipelineStepItem): SerializeResult => {
  const modifyStep = step as ModifyStepType;
  return serializeModifyRows(modifyStep.rows, step.id);
};

export const serializeModifyStepPartial = (step: PipelineStepItem, rowIndex: number): SerializeResult => {
  const modifyStep = step as ModifyStepType;
  const rows = modifyStep.rows?.slice(0, rowIndex);
  return serializeModifyRows(rows, step.id);
};
