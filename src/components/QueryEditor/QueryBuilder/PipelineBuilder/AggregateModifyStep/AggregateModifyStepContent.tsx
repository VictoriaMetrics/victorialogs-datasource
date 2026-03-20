import React from 'react';

import { Menu } from '@grafana/ui';

import { createStepContent } from '../shared/createStepContent';
import { AggregateModifyStep as AggregateModifyStepType, PipelineStepItem } from '../types';

import AggregateModifyRowContainer from './AggregateModifyRowContainer';
import AGGREGATE_MODIFY_TYPE_CONFIG, { AGGREGATE_MODIFY_TYPE_ENTRIES } from './aggregateModifyTypeConfig';
import { AggregateModifyRow, AggregateModifyType, createAggregateModifyRow } from './types';

const addRow = (handleAddRow: (row: AggregateModifyRow) => void, aggregateModifyType: AggregateModifyType) => {
  handleAddRow(createAggregateModifyRow(aggregateModifyType, AGGREGATE_MODIFY_TYPE_CONFIG[aggregateModifyType].createInitialRow()));
};

export default createStepContent<AggregateModifyRow>(
  {
    getRows: (step: PipelineStepItem) => (step as AggregateModifyStepType).rows ?? [],
    RowContainer: AggregateModifyRowContainer,
    addButtonLabel: 'Add function',
    renderMenu: (handleAddRow) => (
      <Menu>
        {AGGREGATE_MODIFY_TYPE_ENTRIES.map(({ aggregateModifyType, label, description }) => (
          <Menu.Item
            key={aggregateModifyType}
            label={label}
            description={description}
            onClick={() => addRow(handleAddRow, aggregateModifyType)}
          />
        ))}
      </Menu>
    ),
  },
  'AggregateModifyStepContent'
);
