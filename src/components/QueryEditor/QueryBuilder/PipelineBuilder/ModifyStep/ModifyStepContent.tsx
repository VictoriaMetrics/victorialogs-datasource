import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Dropdown, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { useRowManagement } from '../shared/useRowManagement';
import { createModifyRow, ModifyRow, ModifyType, PipelineStepItem } from '../types';

import ModifyRowContainer from './ModifyRowContainer';
import { MODIFY_TYPE_GROUPED_ENTRIES } from './modifyTypeConfig';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: Partial<Omit<PipelineStepItem, 'id' | 'type'>>) => void;
}

const ModifyStepContent = memo(function ModifyStepContent({ step, datasource, timeRange, onStepChange }: Props) {
  const styles = useStyles2(getStyles);
  const rows = step.modifyRows ?? [];

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<ModifyRow>({
    rows,
    stepId: step.id,
    rowsKey: 'modifyRows',
    onStepChange,
  });

  const onAddModify = useCallback(
    (modifyType: ModifyType) => {
      handleAddRow(createModifyRow(modifyType));
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
            canDelete={rows.length > 1}
            onChange={handleRowChange}
            onDelete={() => handleRowDelete(row.id)}
          />
        </React.Fragment>
      ))}
      <Dropdown overlay={menu}>
        <Button variant='secondary' icon='plus' size='sm'>
          Add modify
        </Button>
      </Dropdown>
    </Stack>
  );
});

export default ModifyStepContent;

const getStyles = (theme: GrafanaTheme2) => ({
  separator: css`
    display: inline-block;
    width: 2px;
    height: ${theme.spacing(4)};
    background-color: ${theme.colors.border.strong};
    margin: 0 ${theme.spacing(0.5)};
    flex-shrink: 0;
  `,
});
