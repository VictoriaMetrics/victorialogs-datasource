import React from 'react';

import { Menu } from '@grafana/ui';

import { createStepContent } from '../shared/createStepContent';
import { ModifyStep, PipelineStepItem } from '../types';

import ModifyRowContainer from './ModifyRowContainer';
import MODIFY_TYPE_CONFIG, { MODIFY_TYPE_GROUPED_ENTRIES } from './modifyTypeConfig';
import { createModifyRow, MODIFY_TYPE, ModifyRow, ModifyType } from './types';

const addModify = (handleAddRow: (row: ModifyRow) => void, modifyType: ModifyType) => {
  handleAddRow(createModifyRow(modifyType, MODIFY_TYPE_CONFIG[modifyType].createInitialRow()));
};

export default createStepContent<ModifyRow>(
  {
    getRows: (step: PipelineStepItem) => (step as ModifyStep).rows ?? [],
    RowContainer: ModifyRowContainer,
    addButtonLabel: 'Add modify',
    renderMenu: (handleAddRow) => (
      <Menu>
        {MODIFY_TYPE_GROUPED_ENTRIES.map(({ group, entries }) => (
          <Menu.Item
            key={group}
            label={group}
            childItems={entries.map(({ modifyType, label, description }) => (
              <Menu.Item
                key={modifyType}
                label={label}
                description={description}
                onClick={() => addModify(handleAddRow, modifyType)}
              />
            ))}
          />
        ))}
        <Menu.Divider />
        <Menu.Item label='Custom' onClick={() => addModify(handleAddRow, MODIFY_TYPE.CustomPipe)} />
      </Menu>
    ),
  },
  'ModifyStepContent'
);
