import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { PipelineStepItem, STEP_TYPE_LABELS } from './types';

interface Props {
  step: PipelineStepItem;
  index: number;
  onDelete: (id: string) => void;
}

const PipelineStep = memo<Props>(({ step, index, onDelete }) => {
  const styles = useStyles2(getStyles);
  const isFirst = index === 0;

  const handleDelete = useCallback(() => onDelete(step.id), [onDelete, step.id]);

  return (
    <div className={styles.card}>
      <Stack direction='row' alignItems='center' gap={1}>
        <span className={styles.index}>{index + 1}</span>
        <span className={styles.typeLabel}>{STEP_TYPE_LABELS[step.type] ?? step.type}</span>
        <span className={styles.placeholder}>
          {/* Placeholder for future step-specific content */}
          {'Step content goes here'}
        </span>
        <div className={styles.controls}>
          <IconButton
            name='trash-alt'
            aria-label='Delete step'
            size='sm'
            onClick={handleDelete}
            disabled={isFirst}
            tooltip={isFirst ? 'Cannot delete the initial Filter' : 'Delete step'}
          />
        </div>
      </Stack>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  card: css`
    display: flex;
    align-items: center;
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    background-color: ${theme.colors.background.secondary};
  `,
  index: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${theme.spacing(3)};
    height: ${theme.spacing(3)};
    border-radius: ${theme.shape.radius.circle};
    background-color: ${theme.colors.primary.main};
    color: ${theme.colors.primary.contrastText};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
    flex-shrink: 0;
  `,
  typeLabel: css`
    font-weight: ${theme.typography.fontWeightMedium};
    font-size: ${theme.typography.body.fontSize};
    min-width: ${theme.spacing(10)};
  `,
  placeholder: css`
    flex: 1;
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  controls: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    flex-shrink: 0;
  `,
});

PipelineStep.displayName = 'PipelineStep';

export default PipelineStep;
