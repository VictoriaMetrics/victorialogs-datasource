export const AGGREGATE_TYPE = {
  Count: 'count',
  Sum: 'sum',
  Avg: 'avg',
  Min: 'min',
  Max: 'max',
  Median: 'median',
  Quantile: 'quantile',
  Rate: 'rate',
  Histogram: 'histogram',
} as const;

export type AggregateType = (typeof AGGREGATE_TYPE)[keyof typeof AGGREGATE_TYPE];

export interface AggregateRow {
  id: string;
  aggregateType: AggregateType;
  resultName: string;
  fieldList?: string[];
  ifFilter?: string;
  phi?: string;
  limit?: string;
}

import { createIdGenerator } from '../shared/generateId';

export const generateAggregateRowId = createIdGenerator('aggregate-row');

export const createAggregateRow = (aggregateType: AggregateType, initialData: Partial<AggregateRow> = {}): AggregateRow => ({
  id: generateAggregateRowId(),
  aggregateType,
  resultName: '',
  ...initialData,
});
