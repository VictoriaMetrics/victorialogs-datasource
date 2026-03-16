import LIMIT_TYPE_CONFIG from '../LimitStep/limitTypeConfig';
import { LimitRow } from '../LimitStep/types';

import { SerializeResult } from './types';

export const serializeLimitStep = (rows: LimitRow[] | undefined, stepId: string): SerializeResult => {
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
