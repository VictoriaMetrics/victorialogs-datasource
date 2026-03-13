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

let aggregateModifyRowIdCounter = 0;

export const generateAggregateModifyRowId = (): string => {
  aggregateModifyRowIdCounter += 1;
  return `aggregate-modify-row-${Date.now()}-${aggregateModifyRowIdCounter}`;
};

export const createAggregateModifyRow = (aggregateModifyType: AggregateModifyType): AggregateModifyRow => ({
  id: generateAggregateModifyRowId(),
  aggregateModifyType,
  expression: '',
  resultName: '',
});
