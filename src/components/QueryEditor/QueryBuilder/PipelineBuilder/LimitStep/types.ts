export const LIMIT_TYPE = {
  Limit: 'limit',
  Offset: 'offset',
  First: 'first',
  Last: 'last',
  Top: 'top',
} as const;

export type LimitType = (typeof LIMIT_TYPE)[keyof typeof LIMIT_TYPE];

export interface LimitRow {
  id: string;
  limitType: LimitType;
  count?: string;
  fieldList?: string[];
  partitionByFields?: string[];
}

let limitRowIdCounter = 0;

export const generateLimitRowId = (): string => {
  limitRowIdCounter += 1;
  return `limit-row-${Date.now()}-${limitRowIdCounter}`;
};

export const createLimitRow = (limitType: LimitType): LimitRow => ({
  id: generateLimitRowId(),
  limitType,
  count: limitType === LIMIT_TYPE.Limit ? '10' : '',
});
