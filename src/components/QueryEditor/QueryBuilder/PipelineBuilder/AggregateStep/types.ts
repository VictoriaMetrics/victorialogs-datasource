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
  CustomPipe: 'customPipe',
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
  expression?: string;
}

let aggregateRowIdCounter = 0;

export const generateAggregateRowId = (): string => {
  aggregateRowIdCounter += 1;
  return `aggregate-row-${Date.now()}-${aggregateRowIdCounter}`;
};

export const createAggregateRow = (aggregateType: AggregateType, initialData: Partial<AggregateRow> = {}): AggregateRow => ({
  id: generateAggregateRowId(),
  aggregateType,
  resultName: '',
  ...initialData,
});
