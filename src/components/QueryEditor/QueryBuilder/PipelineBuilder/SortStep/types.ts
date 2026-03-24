export const SORT_DIRECTION = {
  Asc: 'asc',
  Desc: 'desc',
} as const;

export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

export interface SortField {
  id: string;
  field: string;
  direction: SortDirection;
}

import { createIdGenerator } from '../shared/generateId';

export const generateSortFieldId = createIdGenerator('sort-field');

export const createSortField = (): SortField => ({
  id: generateSortFieldId(),
  field: '',
  direction: SORT_DIRECTION.Asc,
});
