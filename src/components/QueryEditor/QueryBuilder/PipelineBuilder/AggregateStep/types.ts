export const AGGREGATE_TYPE = {
  Count: 'count',
  CountEmpty: 'count_empty',
  Sum: 'sum',
  Avg: 'avg',
  Min: 'min',
  Max: 'max',
  Median: 'median',
  Quantile: 'quantile',
  SumLen: 'sum_len',
  CountUniq: 'count_uniq',
  CountUniqHash: 'count_uniq_hash',
  UniqValues: 'uniq_values',
  Values: 'values',
  Rate: 'rate',
  RateSum: 'rate_sum',
  Any: 'any',
  FieldMax: 'field_max',
  FieldMin: 'field_min',
  Histogram: 'histogram',
  JsonValues: 'json_values',
  RowAny: 'row_any',
  RowMax: 'row_max',
  RowMin: 'row_min',
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
  referenceField?: string;
  sortField?: string;
  sortDirection?: string;
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
