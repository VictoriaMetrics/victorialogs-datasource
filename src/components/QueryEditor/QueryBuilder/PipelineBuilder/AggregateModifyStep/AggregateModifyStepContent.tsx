import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Dropdown, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { serializePartialPipeline } from '../serialization/serializePartialPipeline';
import { useRowManagement } from '../shared/useRowManagement';
import { AggregateModifyStep as AggregateModifyStepType, PipelineStepItem, PipelineStepPatch } from '../types';

import AggregateModifyRowContainer from './AggregateModifyRowContainer';
import { AGGREGATE_MODIFY_TYPE_ENTRIES } from './aggregateModifyTypeConfig';
import { AggregateModifyRow, AggregateModifyType, createAggregateModifyRow } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const AggregateModifyStepContent = memo(function AggregateModifyStepContent({
  step,
  datasource,
  timeRange,
  onStepChange,
  steps,
  stepIndex,
}: Props) {
  const styles = useStyles2(getStyles);
  const rows = (step as AggregateModifyStepType).rows ?? [];

  const getQueryContext = useCallback(
    (rowIndex: number) => serializePartialPipeline(steps, stepIndex, rowIndex),
    [steps, stepIndex]
  );

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<AggregateModifyRow>({
    rows,
    stepId: step.id,
    onStepChange,
  });

  const onAddRow = useCallback(
    (aggregateModifyType: AggregateModifyType) => {
      handleAddRow(createAggregateModifyRow(aggregateModifyType));
    },
    [handleAddRow]
  );

  const menu = (
    <Menu>
      {AGGREGATE_MODIFY_TYPE_ENTRIES.map(({ aggregateModifyType, label, description }) => (
        <Menu.Item
          key={aggregateModifyType}
          label={label}
          description={description}
          onClick={() => onAddRow(aggregateModifyType)}
        />
      ))}
    </Menu>
  );

  return (
    <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
      {rows.map((row, index) => (
        <React.Fragment key={row.id}>
          {index > 0 && <span className={styles.separator} />}
          <AggregateModifyRowContainer
            row={row}
            datasource={datasource}
            timeRange={timeRange}
            canDelete={rows.length > 1}
            onChange={handleRowChange}
            onDelete={() => handleRowDelete(row.id)}
            queryContext={getQueryContext(index)}
          />
        </React.Fragment>
      ))}
      <Dropdown overlay={menu}>
        <Button variant='secondary' icon='plus' size='sm'>
          Add function
        </Button>
      </Dropdown>
    </Stack>
  );
});

export default AggregateModifyStepContent;

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
