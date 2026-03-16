import MODIFY_TYPE_CONFIG from '../ModifyStep/modifyTypeConfig';
import { ModifyRow } from '../ModifyStep/types';

import { SerializeResult } from './types';

export const serializeModifyStep = (rows: ModifyRow[] | undefined, stepId: string): SerializeResult => {
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
