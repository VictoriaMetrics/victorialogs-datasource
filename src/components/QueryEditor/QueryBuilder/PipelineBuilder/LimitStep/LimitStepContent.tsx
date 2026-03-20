import React, { memo, useCallback } from 'react';

import { TimeRange } from '@grafana/data';
import { Button, Dropdown, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { serializePartialPipeline } from '../serialization/serializePartialPipeline';
import { getSharedStyles } from '../shared/styles';
import { useRowManagement } from '../shared/useRowManagement';
import { LimitStep, PipelineStepItem, PipelineStepPatch } from '../types';

import LimitRowContainer from './LimitRowContainer';
import LIMIT_TYPE_CONFIG, { LIMIT_TYPE_GROUPED_ENTRIES } from './limitTypeConfig';
import { createLimitRow, LIMIT_TYPE, LimitRow, LimitType } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const LimitStepContent = memo(function LimitStepContent({ step, datasource, timeRange, onStepChange, steps, stepIndex }: Props) {
  const styles = useStyles2(getSharedStyles);
  const rows = (step as LimitStep).rows ?? [];

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<LimitRow>({
    rows,
    stepId: step.id,
    onStepChange,
  });

  const getQueryContext = useCallback(
    (rowIndex: number) => serializePartialPipeline(steps, stepIndex, rowIndex),
    [steps, stepIndex]
  );

  const onAddLimit = useCallback(
    (limitType: LimitType) => {
      handleAddRow(createLimitRow(limitType, LIMIT_TYPE_CONFIG[limitType].createInitialRow()));
    },
    [handleAddRow]
  );

  const menu = (
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
              onClick={() => onAddLimit(limitType)}
            />
          ))}
        />
      ))}
      <Menu.Divider />
      <Menu.Item label='Custom' onClick={() => onAddLimit(LIMIT_TYPE.CustomPipe)} />
    </Menu>
  );

  return (
    <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
      {rows.map((row, index) => (
        <React.Fragment key={row.id}>
          {index > 0 && <span className={styles.separator} />}
          <LimitRowContainer
            row={row}
            datasource={datasource}
            timeRange={timeRange}
            canDelete={true}
            onChange={handleRowChange}
            onDelete={() => handleRowDelete(row.id)}
            queryContext={getQueryContext(index)}
          />
        </React.Fragment>
      ))}
      <Dropdown overlay={menu}>
        <Button variant='secondary' icon='plus' size='sm'>
          Add limit
        </Button>
      </Dropdown>
    </Stack>
  );
});

export default LimitStepContent;
