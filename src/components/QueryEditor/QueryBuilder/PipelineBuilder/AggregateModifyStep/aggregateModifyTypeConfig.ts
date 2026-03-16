import React from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { escapeQuotes, RowSerializeResult } from '../serialization/types';
import CustomPipeEditor from '../shared/CustomPipeEditor';
import PackJsonEditor from '../shared/PackJsonEditor';

import ExpressionEditor from './parts/ExpressionEditor';
import { AGGREGATE_MODIFY_TYPE, AggregateModifyRow, AggregateModifyType } from './types';

export interface AggregateModifyRowContentProps {
  row: AggregateModifyRow;
  onChange: (updatedRow: AggregateModifyRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
}

export interface AggregateModifyTypeDefinition {
  label: string;
  description: string;
  ContentComponent: React.FC<AggregateModifyRowContentProps>;
  serialize: (row: AggregateModifyRow, stepId: string) => RowSerializeResult;
}

const AGGREGATE_MODIFY_TYPE_CONFIG: Record<AggregateModifyType, AggregateModifyTypeDefinition> = {
  [AGGREGATE_MODIFY_TYPE.Math]: {
    label: 'math',
    description: 'Performs mathematical calculations on fields',
    ContentComponent: ExpressionEditor,
    serialize: (row) => {
      if (!row.expression || !row.resultName) {
        return { result: '' };
      }
      return { result: `math ${row.expression} as ${row.resultName}` };
    },
  },
  [AGGREGATE_MODIFY_TYPE.Format]: {
    label: 'format',
    description: 'Formats fields using a pattern template',
    ContentComponent: ExpressionEditor,
    serialize: (row) => {
      if (!row.expression || !row.resultName) {
        return { result: '' };
      }
      return { result: `format "${escapeQuotes(row.expression)}" as ${row.resultName}` };
    },
  },
  [AGGREGATE_MODIFY_TYPE.PackJson]: {
    label: 'pack_json',
    description: 'Packs specified fields into a JSON object',
    ContentComponent: PackJsonEditor as React.FC<AggregateModifyRowContentProps>,
    serialize: (row) => {
      let result = 'pack_json';
      const fields = (row.fieldList ?? []).filter(Boolean);
      if (fields.length) {
        result += ` fields (${fields.join(', ')})`;
      }
      if (row.resultField) {
        result += ` as ${row.resultField}`;
      }
      return { result };
    },
  },
  [AGGREGATE_MODIFY_TYPE.CustomPipe]: {
    label: 'Custom',
    description: 'Add a raw pipe expression',
    ContentComponent: CustomPipeEditor as React.FC<AggregateModifyRowContentProps>,
    serialize: (row) => ({ result: row.expression ?? '' }),
  },
};

export default AGGREGATE_MODIFY_TYPE_CONFIG;

export const AGGREGATE_MODIFY_TYPE_ENTRIES = Object.entries(AGGREGATE_MODIFY_TYPE_CONFIG).map(
  ([aggregateModifyType, config]) => ({
    aggregateModifyType: aggregateModifyType as AggregateModifyType,
    label: config.label,
    description: config.description,
  })
);
