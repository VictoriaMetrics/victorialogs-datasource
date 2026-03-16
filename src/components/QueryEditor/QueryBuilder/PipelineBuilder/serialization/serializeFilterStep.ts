import FILTER_TYPE_CONFIG from '../FilterStep/filterTypeConfig';
import { FilterRow } from '../FilterStep/types';

import { SerializeResult } from './types';

export const serializeFilterStep = (rows: FilterRow[] | undefined, stepId: string): SerializeResult => {
  if (!rows?.length) {
    return { pipes: [] };
  }

  const parts: string[] = [];

  for (const row of rows) {
    const config = FILTER_TYPE_CONFIG[row.filterType];
    const { result } = config.serialize(row, stepId);
    if (result) {
      parts.push(result);
    }
  }

  const joined = parts.join(' ');
  return {
    pipes: joined ? [joined] : [],
  };
};
