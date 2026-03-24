export const LIMIT_TYPE = {
  Limit: 'limit',
  Offset: 'offset',
  First: 'first',
  Last: 'last',
  Top: 'top',
  CustomPipe: 'customPipe',
} as const;

export type LimitType = (typeof LIMIT_TYPE)[keyof typeof LIMIT_TYPE];

export interface LimitRow {
  id: string;
  limitType: LimitType;
  count?: string;
  fieldList?: string[];
  partitionByFields?: string[];
  expression?: string;
}

import { createIdGenerator } from '../shared/generateId';

export const generateLimitRowId = createIdGenerator('limit-row');

export const createLimitRow = (limitType: LimitType, initialData: Partial<LimitRow> = {}): LimitRow => ({
  id: generateLimitRowId(),
  limitType,
  ...initialData,
});
