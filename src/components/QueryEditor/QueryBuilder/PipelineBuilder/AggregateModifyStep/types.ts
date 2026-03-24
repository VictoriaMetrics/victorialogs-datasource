export const AGGREGATE_MODIFY_TYPE = {
  Math: 'math',
  Format: 'format',
  PackJson: 'pack_json',
} as const;

export type AggregateModifyType = (typeof AGGREGATE_MODIFY_TYPE)[keyof typeof AGGREGATE_MODIFY_TYPE];

export interface AggregateModifyRow {
  id: string;
  aggregateModifyType: AggregateModifyType;
  expression: string;
  resultName: string;
  fieldList?: string[];
  resultField?: string;
}

import { createIdGenerator } from '../shared/generateId';

export const generateAggregateModifyRowId = createIdGenerator('aggregate-modify-row');

export const createAggregateModifyRow = (aggregateModifyType: AggregateModifyType, initialData: Partial<AggregateModifyRow> = {}): AggregateModifyRow => ({
  id: generateAggregateModifyRowId(),
  aggregateModifyType,
  expression: '',
  resultName: '',
  ...initialData,
});
