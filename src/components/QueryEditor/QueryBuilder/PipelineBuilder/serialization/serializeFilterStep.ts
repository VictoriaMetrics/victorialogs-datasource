import FILTER_TYPE_CONFIG from '../FilterStep/filterTypeConfig';
import { FILTER_TYPE, FilterRow } from '../FilterStep/types';

import { SerializeResult } from './types';

export const serializeFilterStep = (rows: FilterRow[] | undefined, stepId: string): SerializeResult => {
  if (!rows?.length) {
    return { pipes: [] };
  }

  const filterParts: string[] = [];
  const customPipes: string[] = [];

  for (const row of rows) {
    if (row.filterType === FILTER_TYPE.CustomPipe) {
      const value = row.expression;
      if (value) {
        customPipes.push(value);
      }
      continue;
    }

    const config = FILTER_TYPE_CONFIG[row.filterType];
    const { result } = config.serialize(row, stepId);
    if (result) {
      filterParts.push(result);
    }
  }

  const joined = filterParts.join(' ');
  const pipes = joined ? [joined, ...customPipes] : customPipes;
  return { pipes };
};
