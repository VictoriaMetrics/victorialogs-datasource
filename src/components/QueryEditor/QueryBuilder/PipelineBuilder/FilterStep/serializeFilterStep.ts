import { SerializeResult } from '../serialization/types';
import { FilterStep, ModifyFilterStep, PipelineStepItem } from '../types';

import FILTER_TYPE_CONFIG from './filterTypeConfig';
import { FilterRow } from './types';

export const serializeFilterRows = (rows: FilterRow[] | undefined, stepId: string): SerializeResult => {
  if (!rows?.length) {
    return { pipes: [] };
  }

  const filterParts: string[] = [];

  for (const row of rows) {
    const config = FILTER_TYPE_CONFIG[row.filterType];
    const { result } = config.serialize(row, stepId);
    if (result) {
      filterParts.push(result);
    }
  }

  const joined = filterParts.join(' ');
  return { pipes: joined ? [joined] : [] };
};

export const serializeFilterStep = (step: PipelineStepItem): SerializeResult => {
  const filterStep = step as FilterStep | ModifyFilterStep;
  return serializeFilterRows(filterStep.rows, step.id);
};

export const serializeFilterStepPartial = (step: PipelineStepItem, rowIndex: number): SerializeResult => {
  const filterStep = step as FilterStep | ModifyFilterStep;
  const rows = filterStep.rows?.slice(0, rowIndex);
  return serializeFilterRows(rows, step.id);
};
