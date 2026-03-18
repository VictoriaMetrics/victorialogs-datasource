import { SerializeResult } from '../serialization/types';
import { AggregateModifyStep as AggregateModifyStepType, PipelineStepItem } from '../types';

import AGGREGATE_MODIFY_TYPE_CONFIG from './aggregateModifyTypeConfig';
import { AggregateModifyRow } from './types';

export const serializeAggregateModifyRows = (rows: AggregateModifyRow[] | undefined, stepId: string): SerializeResult => {
  if (!rows?.length) {
    return { pipes: [] };
  }

  const pipes: string[] = [];

  for (const row of rows) {
    const config = AGGREGATE_MODIFY_TYPE_CONFIG[row.aggregateModifyType];
    const { result } = config.serialize(row, stepId);
    if (result) {
      pipes.push(result);
    }
  }

  return { pipes };
};

export const serializeAggregateModifyStep = (step: PipelineStepItem): SerializeResult => {
  const modifyStep = step as AggregateModifyStepType;
  return serializeAggregateModifyRows(modifyStep.rows, step.id);
};

export const serializeAggregateModifyStepPartial = (step: PipelineStepItem, rowIndex: number): SerializeResult => {
  const modifyStep = step as AggregateModifyStepType;
  const rows = modifyStep.rows?.slice(0, rowIndex);
  return serializeAggregateModifyRows(rows, step.id);
};
