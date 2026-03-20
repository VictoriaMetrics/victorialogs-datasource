import React from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import EmptyContent from '../ModifyStep/parts/EmptyContent';
import { RowSerializeResult } from '../serialization/types';
import CustomPipeEditor from '../shared/CustomPipeEditor';

import FieldListEditor from './parts/FieldListEditor';
import QuantileEditor from './parts/QuantileEditor';
import SingleFieldEditor from './parts/SingleFieldEditor';
import { AGGREGATE_TYPE, AggregateRow, AggregateType } from './types';

export interface AggregateRowContentProps {
  row: AggregateRow;
  onChange: (updatedRow: AggregateRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext?: string;
}

export interface AggregateTypeDefinition {
  label: string;
  description: string;
  ContentComponent: React.FC<AggregateRowContentProps>;
  serialize: (row: AggregateRow, stepId: string) => RowSerializeResult;
  createInitialRow: () => Partial<AggregateRow>;
}

const serializeNoArgs = (row: AggregateRow): RowSerializeResult => {
  return { result: `${row.aggregateType}()` };
};

const serializeFieldList = (row: AggregateRow): RowSerializeResult => {
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (!fields.length) {
    return { result: '' };
  }
  return { result: `${row.aggregateType}(${fields.join(', ')})` };
};


const AGGREGATE_TYPE_CONFIG: Record<AggregateType, AggregateTypeDefinition> = {
  [AGGREGATE_TYPE.Count]: {
    label: 'count',
    description: 'Counts the number of log entries',
    ContentComponent: FieldListEditor,
    serialize: serializeNoArgs,
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.Sum]: {
    label: 'sum',
    description: 'Calculates the sum of numeric field values',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.Avg]: {
    label: 'avg',
    description: 'Calculates the average of numeric field values',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.Min]: {
    label: 'min',
    description: 'Returns the minimum value',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.Max]: {
    label: 'max',
    description: 'Returns the maximum value',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.Median]: {
    label: 'median',
    description: 'Calculates the median value',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.Quantile]: {
    label: 'quantile',
    description: 'Calculates the given quantile for the specified fields',
    ContentComponent: QuantileEditor,
    serialize: (row) => {
      const fields = (row.fieldList ?? []).filter(Boolean);
      if (!row.phi || !fields.length) {
        return { result: '' };
      }
      return { result: `quantile(${row.phi}, ${fields.join(', ')})` };
    },
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.Rate]: {
    label: 'rate',
    description: 'Calculates the per-second rate of matching log entries',
    ContentComponent: EmptyContent,
    serialize: serializeNoArgs,
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.Histogram]: {
    label: 'histogram',
    description: 'Builds a histogram over the specified numeric field',
    ContentComponent: SingleFieldEditor,
    serialize: serializeFieldList,
    createInitialRow: () => ({}),
  },
  [AGGREGATE_TYPE.CustomPipe]: {
    label: 'Custom',
    description: 'Add a raw pipe expression',
    ContentComponent: CustomPipeEditor,
    serialize: (row) => ({ result: row.expression ?? '' }),
    createInitialRow: () => ({}),
  },
};

export default AGGREGATE_TYPE_CONFIG;

export const AGGREGATE_TYPE_FLAT_ENTRIES = Object.entries(AGGREGATE_TYPE_CONFIG)
  .filter(([key]) => key !== AGGREGATE_TYPE.CustomPipe)
  .map(([aggregateType, config]) => ({
    aggregateType: aggregateType as AggregateType,
    label: config.label,
    description: config.description,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));
