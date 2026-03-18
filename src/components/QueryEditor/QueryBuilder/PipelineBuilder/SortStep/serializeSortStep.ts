import { SerializeResult } from '../serialization/types';
import { PipelineStepItem, SortStep } from '../types';

import { SortField } from './types';

export const serializeSortStep = (step: PipelineStepItem): SerializeResult => {
  const sortStep = step as SortStep;

  if (!sortStep.rows?.length) {
    return { pipes: [] };
  }

  const validFields: SortField[] = [];

  for (const field of sortStep.rows) {
    if (field.field) {
      validFields.push(field);
    }
  }

  if (!validFields.length) {
    return { pipes: [] };
  }

  const fieldParts = validFields.map((f) => `${f.field} ${f.direction}`);
  let pipe = `sort by (${fieldParts.join(', ')})`;

  if (sortStep.offset) {
    pipe += ` offset ${sortStep.offset}`;
  }
  if (sortStep.limit) {
    pipe += ` limit ${sortStep.limit}`;
  }

  const partitionFields = (sortStep.partitionByFields ?? []).filter(Boolean);
  if (partitionFields.length) {
    pipe += ` partition by (${partitionFields.join(', ')})`;
  }

  if (sortStep.rankField) {
    pipe += ` rank as ${sortStep.rankField}`;
  }

  return { pipes: [pipe] };
};
