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

let sortFieldIdCounter = 0;

export const generateSortFieldId = (): string => {
  sortFieldIdCounter += 1;
  return `sort-field-${Date.now()}-${sortFieldIdCounter}`;
};

export const createSortField = (): SortField => ({
  id: generateSortFieldId(),
  field: '',
  direction: SORT_DIRECTION.Asc,
});
