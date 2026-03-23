import React, { memo } from 'react';

import { TimeRange } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';

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
}

interface StepContentProps {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  onDeleteStep: (id: string) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

export function createStepContent<TRow extends { id: string }>(
  config: StepContentConfig<TRow>,
  displayName: string
): React.NamedExoticComponent<StepContentProps> {
  const { getRows, RowContainer } = config;

  const StepContent = memo(function StepContent({
    step,
    datasource,
    timeRange,
    onStepChange,
    onDeleteStep,
    steps,
    stepIndex,
  }: StepContentProps) {
    const styles = useStyles2(getSharedStyles);
    const rows = getRows(step);

    const { handleRowChange, handleRowDelete } = useRowManagement<TRow>({
      rows,
      stepId: step.id,
      onStepChange,
      onDeleteStep,
    });

    const queryContexts = useQueryContexts(steps, stepIndex, rows.length);

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
      </Stack>
    );
  });

  StepContent.displayName = displayName;

  return StepContent;
}
