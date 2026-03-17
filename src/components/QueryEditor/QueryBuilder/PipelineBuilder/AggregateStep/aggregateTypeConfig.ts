import React from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import EmptyContent from '../ModifyStep/parts/EmptyContent';
import { RowSerializeResult } from '../serialization/types';
import CustomPipeEditor from '../shared/CustomPipeEditor';

import FieldListEditor from './parts/FieldListEditor';
import FieldListWithLimitEditor from './parts/FieldListWithLimitEditor';
import JsonValuesEditor from './parts/JsonValuesEditor';
import QuantileEditor from './parts/QuantileEditor';
import RowFunctionEditor from './parts/RowFunctionEditor';
import SingleFieldEditor from './parts/SingleFieldEditor';
import TwoFieldEditor from './parts/TwoFieldEditor';
import { AGGREGATE_TYPE, AggregateRow, AggregateType } from './types';

export interface AggregateRowContentProps {
  row: AggregateRow;
  onChange: (updatedRow: AggregateRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext?: string;
}

export type AggregateGroup =
  | 'Counting'
  | 'Math & Statistics'
  | 'Value Selection'
  | 'Unique Values'
  | 'Rate'
  | 'Structured Data'
  | 'Row Functions';

export interface AggregateTypeDefinition {
  label: string;
  description: string;
  group: AggregateGroup;
  ContentComponent: React.FC<AggregateRowContentProps>;
  serialize: (row: AggregateRow, stepId: string) => RowSerializeResult;
}

const serializeNoArgs = (row: AggregateRow): RowSerializeResult => {
  if (!row.resultName) {
    return { result: '' };
  }
  return { result: `${row.aggregateType}()` };
};

const serializeFieldList = (row: AggregateRow): RowSerializeResult => {
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (!row.resultName || !fields.length) {
    return { result: '' };
  }
  return { result: `${row.aggregateType}(${fields.join(', ')})` };
};

const serializeFieldListWithLimit = (row: AggregateRow): RowSerializeResult => {
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (!row.resultName || !fields.length) {
    return { result: '' };
  }
  let funcStr = `${row.aggregateType}(${fields.join(', ')})`;
  if (row.limit) {
    funcStr += ` limit ${row.limit}`;
  }
  return { result: funcStr };
};

const serializeSingleField = (row: AggregateRow): RowSerializeResult => {
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (!row.resultName || !fields.length) {
    return { result: '' };
  }
  return { result: `${row.aggregateType}(${fields.join(', ')})` };
};

const serializeTwoFields = (row: AggregateRow): RowSerializeResult => {
  const fields = (row.fieldList ?? []).filter(Boolean);
  if (!row.resultName || !row.referenceField || !fields.length) {
    return { result: '' };
  }
  return { result: `${row.aggregateType}(${row.referenceField}, ${fields.join(', ')})` };
};

const serializeRowFunction = (row: AggregateRow): RowSerializeResult => {
  if (!row.resultName || !row.referenceField) {
    return { result: '' };
  }
  return { result: `${row.aggregateType}(${row.referenceField})` };
};

const AGGREGATE_TYPE_CONFIG: Record<AggregateType, AggregateTypeDefinition> = {
  [AGGREGATE_TYPE.Count]: {
    label: 'count',
    description: 'Counts the number of log entries',
    group: 'Counting',
    ContentComponent: FieldListEditor,
    serialize: serializeNoArgs,
  },
  [AGGREGATE_TYPE.CountEmpty]: {
    label: 'count_empty',
    description: 'Counts the number of log entries with empty fields',
    group: 'Counting',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.Sum]: {
    label: 'sum',
    description: 'Calculates the sum of numeric field values',
    group: 'Math & Statistics',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.Avg]: {
    label: 'avg',
    description: 'Calculates the average of numeric field values',
    group: 'Math & Statistics',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.Min]: {
    label: 'min',
    description: 'Returns the minimum value',
    group: 'Math & Statistics',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.Max]: {
    label: 'max',
    description: 'Returns the maximum value',
    group: 'Math & Statistics',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.Median]: {
    label: 'median',
    description: 'Calculates the median value',
    group: 'Math & Statistics',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.Quantile]: {
    label: 'quantile',
    description: 'Calculates the given quantile for the specified fields',
    group: 'Math & Statistics',
    ContentComponent: QuantileEditor,
    serialize: (row) => {
      const fields = (row.fieldList ?? []).filter(Boolean);
      if (!row.resultName || !row.phi || !fields.length) {
        return { result: '' };
      }
      return { result: `quantile(${row.phi}, ${fields.join(', ')})` };
    },
  },
  [AGGREGATE_TYPE.SumLen]: {
    label: 'sum_len',
    description: 'Calculates the sum of lengths of field values',
    group: 'Math & Statistics',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.CountUniq]: {
    label: 'count_uniq',
    description: 'Counts the number of unique values with optional limit',
    group: 'Unique Values',
    ContentComponent: FieldListWithLimitEditor,
    serialize: serializeFieldListWithLimit,
  },
  [AGGREGATE_TYPE.CountUniqHash]: {
    label: 'count_uniq_hash',
    description: 'Counts unique values using hash estimation',
    group: 'Unique Values',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.UniqValues]: {
    label: 'uniq_values',
    description: 'Returns unique values with optional limit',
    group: 'Unique Values',
    ContentComponent: FieldListWithLimitEditor,
    serialize: serializeFieldListWithLimit,
  },
  [AGGREGATE_TYPE.Values]: {
    label: 'values',
    description: 'Returns all values with optional limit',
    group: 'Unique Values',
    ContentComponent: FieldListWithLimitEditor,
    serialize: serializeFieldListWithLimit,
  },
  [AGGREGATE_TYPE.Rate]: {
    label: 'rate',
    description: 'Calculates the per-second rate of matching log entries',
    group: 'Rate',
    ContentComponent: EmptyContent as React.FC<AggregateRowContentProps>,
    serialize: serializeNoArgs,
  },
  [AGGREGATE_TYPE.RateSum]: {
    label: 'rate_sum',
    description: 'Calculates per-second rate of the sum of field values',
    group: 'Rate',
    ContentComponent: FieldListEditor,
    serialize: serializeFieldList,
  },
  [AGGREGATE_TYPE.Any]: {
    label: 'any',
    description: 'Returns an arbitrary value from the specified field',
    group: 'Value Selection',
    ContentComponent: SingleFieldEditor,
    serialize: serializeSingleField,
  },
  [AGGREGATE_TYPE.FieldMax]: {
    label: 'field_max',
    description: 'Returns field value at the row with the maximum reference field',
    group: 'Value Selection',
    ContentComponent: TwoFieldEditor,
    serialize: serializeTwoFields,
  },
  [AGGREGATE_TYPE.FieldMin]: {
    label: 'field_min',
    description: 'Returns field value at the row with the minimum reference field',
    group: 'Value Selection',
    ContentComponent: TwoFieldEditor,
    serialize: serializeTwoFields,
  },
  [AGGREGATE_TYPE.Histogram]: {
    label: 'histogram',
    description: 'Builds a histogram over the specified numeric field',
    group: 'Structured Data',
    ContentComponent: SingleFieldEditor,
    serialize: serializeSingleField,
  },
  [AGGREGATE_TYPE.JsonValues]: {
    label: 'json_values',
    description: 'Returns all values as a JSON array with limit and sort',
    group: 'Structured Data',
    ContentComponent: JsonValuesEditor,
    serialize: (row) => {
      const fields = (row.fieldList ?? []).filter(Boolean);
      if (!row.resultName || !fields.length) {
        return { result: '' };
      }
      let funcStr = `json_values(${fields.join(', ')})`;
      if (row.limit) {
        funcStr += ` limit ${row.limit}`;
      }
      return { result: funcStr };
    },
  },
  [AGGREGATE_TYPE.RowAny]: {
    label: 'row_any',
    description: 'Returns an arbitrary log entry',
    group: 'Row Functions',
    ContentComponent: RowFunctionEditor,
    serialize: serializeNoArgs,
  },
  [AGGREGATE_TYPE.RowMax]: {
    label: 'row_max',
    description: 'Returns the log entry with the maximum reference field value',
    group: 'Row Functions',
    ContentComponent: RowFunctionEditor,
    serialize: serializeRowFunction,
  },
  [AGGREGATE_TYPE.RowMin]: {
    label: 'row_min',
    description: 'Returns the log entry with the minimum reference field value',
    group: 'Row Functions',
    ContentComponent: RowFunctionEditor,
    serialize: serializeRowFunction,
  },
  [AGGREGATE_TYPE.CustomPipe]: {
    label: 'Custom',
    description: 'Add a raw pipe expression',
    group: 'Row Functions',
    ContentComponent: CustomPipeEditor as React.FC<AggregateRowContentProps>,
    serialize: (row) => ({ result: row.expression ?? '' }),
  },
};

export default AGGREGATE_TYPE_CONFIG;

const AGGREGATE_GROUPS: AggregateGroup[] = [
  'Counting',
  'Math & Statistics',
  'Value Selection',
  'Unique Values',
  'Rate',
  'Structured Data',
  'Row Functions',
];

export const AGGREGATE_TYPE_GROUPED_ENTRIES = AGGREGATE_GROUPS.map((group) => ({
  group,
  entries: Object.entries(AGGREGATE_TYPE_CONFIG)
    .filter(([key, config]) => config.group === group && key !== AGGREGATE_TYPE.CustomPipe)
    .map(([aggregateType, config]) => ({
      aggregateType: aggregateType as AggregateType,
      label: config.label,
      description: config.description,
    })),
}));
