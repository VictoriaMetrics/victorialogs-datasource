import AGGREGATE_MODIFY_TYPE_CONFIG from '../AggregateModifyStep/aggregateModifyTypeConfig';
import { AggregateModifyRow } from '../AggregateModifyStep/types';

import { SerializeResult } from './types';

export const serializeAggregateModifyStep = (rows: AggregateModifyRow[] | undefined, stepId: string): SerializeResult => {
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
