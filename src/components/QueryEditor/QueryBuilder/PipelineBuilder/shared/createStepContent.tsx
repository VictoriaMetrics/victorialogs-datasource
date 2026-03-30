import React, { memo } from 'react';

import { Stack, useStyles2 } from '@grafana/ui';

import { PipelineStepItem } from '../types';
import { isFirstFilterAllStep } from '../utils/isFirstFilterAllStep';

import { getSharedStyles } from './styles';
import { RowContainerProps, StepContentProps } from './types';
import { useQueryContexts } from './useQueryContexts';
import { useRowManagement } from './useRowManagement';

export type { RowContainerProps };

interface StepContentConfig<TRow extends { id: string }> {
  getRows: (step: PipelineStepItem) => TRow[];
  RowContainer: React.ComponentType<RowContainerProps<TRow>>;
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
    const isProtected = isFirstFilterAllStep(steps, stepIndex);

    return (
      <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
        {rows.map((row, index) => (
          <React.Fragment key={row.id}>
            {index > 0 && <span className={styles.separator} />}
            <RowContainer
              row={row}
              datasource={datasource}
              timeRange={timeRange}
              canDelete={!isProtected}
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
