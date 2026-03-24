import { SerializeResult } from '../serialization/types';
import { AggregateStep as AggregateStepType, PipelineStepItem } from '../types';

import AGGREGATE_TYPE_CONFIG from './aggregateTypeConfig';
import { AggregateRow } from './types';

const serializeAggregateRow = (
  row: AggregateRow,
  stepId: string
): string => {
  const config = AGGREGATE_TYPE_CONFIG[row.aggregateType];
  const { result } = config.serialize(row, stepId);

  if (!result) {
    return '';
  }

  let funcStr = result;
  if (row.ifFilter) {
    funcStr += ` if (${row.ifFilter})`;
  }
  if (row.resultName) {
    funcStr += ` as ${row.resultName}`;
  }

  return funcStr;
};

export const serializeAggregateRows = (
  rows: AggregateRow[] | undefined,
  byFields: string[] | undefined,
  stepId: string
): SerializeResult => {
  if (!rows?.length) {
    return { pipes: [] };
  }

  const funcParts: string[] = [];

  for (const row of rows) {
    const result = serializeAggregateRow(row, stepId);
    if (result) {
      funcParts.push(result);
    }
  }

  if (!funcParts.length) {
    return { pipes: [] };
  }

  const validByFields = (byFields ?? []).filter(Boolean);
  let pipe = 'stats';
  if (validByFields.length) {
    pipe += ` by (${validByFields.join(', ')})`;
  }
  pipe += ` ${funcParts.join(', ')}`;

  return { pipes: [pipe] };
};

export const serializeAggregateStep = (step: PipelineStepItem): SerializeResult => {
  const aggStep = step as AggregateStepType;
  return serializeAggregateRows(aggStep.rows, aggStep.byFields, step.id);
};

export const serializeAggregateStepPartial = (step: PipelineStepItem, rowIndex: number): SerializeResult => {
  const aggStep = step as AggregateStepType;
  const rows = aggStep.rows?.slice(0, rowIndex);
  return serializeAggregateRows(rows, aggStep.byFields, step.id);
};
