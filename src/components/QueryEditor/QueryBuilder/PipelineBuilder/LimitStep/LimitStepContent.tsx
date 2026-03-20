import React from 'react';

import { Menu } from '@grafana/ui';

import { createStepContent } from '../shared/createStepContent';
import { LimitStep, PipelineStepItem } from '../types';

import LimitRowContainer from './LimitRowContainer';
import LIMIT_TYPE_CONFIG, { LIMIT_TYPE_GROUPED_ENTRIES } from './limitTypeConfig';
import { createLimitRow, LIMIT_TYPE, LimitRow, LimitType } from './types';

const addLimit = (handleAddRow: (row: LimitRow) => void, limitType: LimitType) => {
  handleAddRow(createLimitRow(limitType, LIMIT_TYPE_CONFIG[limitType].createInitialRow()));
};

export default createStepContent<LimitRow>(
  {
    getRows: (step: PipelineStepItem) => (step as LimitStep).rows ?? [],
    RowContainer: LimitRowContainer,
    addButtonLabel: 'Add limit',
    renderMenu: (handleAddRow) => (
      <Menu>
        {LIMIT_TYPE_GROUPED_ENTRIES.map(({ group, entries }) => (
          <Menu.Item
            key={group}
            label={group}
            childItems={entries.map(({ limitType, label, description }) => (
              <Menu.Item
                key={limitType}
                label={label}
                description={description}
                onClick={() => addLimit(handleAddRow, limitType)}
              />
            ))}
          />
        ))}
        <Menu.Divider />
        <Menu.Item label='Custom' onClick={() => addLimit(handleAddRow, LIMIT_TYPE.CustomPipe)} />
      </Menu>
    ),
  },
  'LimitStepContent'
);
