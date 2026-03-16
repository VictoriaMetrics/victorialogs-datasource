import AGGREGATE_TYPE_CONFIG from '../AggregateStep/aggregateTypeConfig';
import { AGGREGATE_TYPE, AggregateRow } from '../AggregateStep/types';

import { SerializeResult } from './types';

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
  funcStr += ` as ${row.resultName}`;

  return funcStr;
};

export const serializeAggregateStep = (
  rows: AggregateRow[] | undefined,
  byFields: string[] | undefined,
  stepId: string
): SerializeResult => {
  if (!rows?.length) {
    return { pipes: [] };
  }

  const funcParts: string[] = [];
  const customPipes: string[] = [];

  for (const row of rows) {
    if (row.aggregateType === AGGREGATE_TYPE.CustomPipe) {
      if (row.expression) {
        customPipes.push(row.expression);
      }
      continue;
    }

    const result = serializeAggregateRow(row, stepId);
    if (result) {
      funcParts.push(result);
    }
  }

  const pipes: string[] = [];

  if (funcParts.length) {
    let pipe = `stats ${funcParts.join(', ')}`;

    const validByFields = (byFields ?? []).filter(Boolean);
    if (validByFields.length) {
      pipe += ` by (${validByFields.join(', ')})`;
    }

    pipes.push(pipe);
  }

  pipes.push(...customPipes);

  return { pipes };
};
