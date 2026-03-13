import React from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../../datasource';

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
}

const AGGREGATE_MODIFY_TYPE_CONFIG: Record<AggregateModifyType, AggregateModifyTypeDefinition> = {
  [AGGREGATE_MODIFY_TYPE.Math]: {
    label: 'math',
    description: 'Performs mathematical calculations on fields',
    ContentComponent: ExpressionEditor,
  },
  [AGGREGATE_MODIFY_TYPE.Format]: {
    label: 'format',
    description: 'Formats fields using a pattern template',
    ContentComponent: ExpressionEditor,
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
