import React, { memo, ReactElement } from 'react';

import { TimeRange } from '@grafana/data';
import { Button, Dropdown, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { PipelineStepItem, PipelineStepPatch } from '../types';

import { getSharedStyles } from './styles';
import { useQueryContexts } from './useQueryContexts';
import { useRowManagement } from './useRowManagement';

export interface RowContainerProps<TRow> {
  row: TRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: TRow) => void;
  onDelete: () => void;
  queryContext?: string;
}

interface StepContentConfig<TRow extends { id: string }> {
  getRows: (step: PipelineStepItem) => TRow[];
  RowContainer: React.ComponentType<RowContainerProps<TRow>>;
  renderMenu: (handleAddRow: (row: TRow) => void) => ReactElement;
  addButtonLabel: string;
}

interface StepContentProps {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

export function createStepContent<TRow extends { id: string }>(
  config: StepContentConfig<TRow>,
  displayName: string
): React.NamedExoticComponent<StepContentProps> {
  const { getRows, RowContainer, renderMenu, addButtonLabel } = config;

  const StepContent = memo(function StepContent({
    step,
    datasource,
    timeRange,
    onStepChange,
    steps,
    stepIndex,
  }: StepContentProps) {
    const styles = useStyles2(getSharedStyles);
    const rows = getRows(step);

    const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<TRow>({
      rows,
      stepId: step.id,
      onStepChange,
    });

    const queryContexts = useQueryContexts(steps, stepIndex, rows.length);

    const menu = renderMenu(handleAddRow);

    return (
      <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
        {rows.map((row, index) => (
          <React.Fragment key={row.id}>
            {index > 0 && <span className={styles.separator} />}
            <RowContainer
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
            {addButtonLabel}
          </Button>
        </Dropdown>
      </Stack>
    );
  });

  StepContent.displayName = displayName;

  return StepContent;
}
