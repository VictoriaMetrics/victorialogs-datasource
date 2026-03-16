import { SortField } from '../SortStep/types';
import { SortStep } from '../types';

import { SerializeResult } from './types';

export const serializeSortStep = (step: SortStep): SerializeResult => {
  if (!step.rows?.length) {
    return { pipes: [] };
  }

  const validFields: SortField[] = [];

  for (const field of step.rows) {
    if (field.field) {
      validFields.push(field);
    }
  }

  if (!validFields.length) {
    return { pipes: [] };
  }

  const fieldParts = validFields.map((f) => `${f.field} ${f.direction}`);
  let pipe = `sort by (${fieldParts.join(', ')})`;

  if (step.offset) {
    pipe += ` offset ${step.offset}`;
  }
  if (step.limit) {
    pipe += ` limit ${step.limit}`;
  }

  const partitionFields = (step.partitionByFields ?? []).filter(Boolean);
  if (partitionFields.length) {
    pipe += ` partition by (${partitionFields.join(', ')})`;
  }

  if (step.rankField) {
    pipe += ` rank as ${step.rankField}`;
  }

  return { pipes: [pipe] };
};
