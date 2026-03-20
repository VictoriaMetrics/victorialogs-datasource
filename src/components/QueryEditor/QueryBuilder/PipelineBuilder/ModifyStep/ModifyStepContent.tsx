import React, { memo, useCallback } from 'react';

import { TimeRange } from '@grafana/data';
import { Button, Dropdown, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { getSharedStyles } from '../shared/styles';
import { useQueryContexts } from '../shared/useQueryContexts';
import { useRowManagement } from '../shared/useRowManagement';
import { ModifyStep, PipelineStepItem, PipelineStepPatch } from '../types';

import ModifyRowContainer from './ModifyRowContainer';
import MODIFY_TYPE_CONFIG, { MODIFY_TYPE_GROUPED_ENTRIES } from './modifyTypeConfig';
import { createModifyRow, MODIFY_TYPE, ModifyRow, ModifyType } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const ModifyStepContent = memo(function ModifyStepContent({ step, datasource, timeRange, onStepChange, steps, stepIndex }: Props) {
  const styles = useStyles2(getSharedStyles);
  const rows = (step as ModifyStep).rows ?? [];

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<ModifyRow>({
    rows,
    stepId: step.id,
    onStepChange,
  });

  const queryContexts = useQueryContexts(steps, stepIndex, rows.length);

  const onAddModify = useCallback(
    (modifyType: ModifyType) => {
      handleAddRow(createModifyRow(modifyType, MODIFY_TYPE_CONFIG[modifyType].createInitialRow()));
    },
    [handleAddRow]
  );

  const menu = (
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
              onClick={() => onAddModify(modifyType)}
            />
          ))}
        />
      ))}
      <Menu.Divider />
      <Menu.Item label='Custom' onClick={() => onAddModify(MODIFY_TYPE.CustomPipe)} />
    </Menu>
  );

  return (
    <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
      {rows.map((row, index) => (
        <React.Fragment key={row.id}>
          {index > 0 && <span className={styles.separator} />}
          <ModifyRowContainer
            row={row}
            datasource={datasource}
            timeRange={timeRange}
            canDelete={true}
            onChange={handleRowChange}
            onDelete={() => handleRowDelete(row.id)}
            queryContext={queryContexts[index]}
          />
        </React.Fragment>
      ))}
      <Dropdown overlay={menu} placement='bottom-start'>
        <Button variant='secondary' icon='plus' size='sm'>
          Add modify
        </Button>
      </Dropdown>
    </Stack>
  );
});

export default ModifyStepContent;
