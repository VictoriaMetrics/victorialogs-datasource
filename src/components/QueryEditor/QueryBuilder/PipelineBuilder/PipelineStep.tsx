import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';

import { STEP_CONFIG } from './stepConfig';
import { PipelineStepItem, PipelineStepPatch } from './types';

interface Props {
  step: PipelineStepItem;
  index: number;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onDelete: (id: string) => void;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
}

const PipelineStep = memo<Props>(({ step, index, datasource, timeRange, onDelete, onStepChange }) => {
  const styles = useStyles2(getStyles);
  const isFirst = index === 0;
  const config = STEP_CONFIG[step.type];
  const ContentComponent = config.ContentComponent;

  const handleDelete = useCallback(() => onDelete(step.id), [onDelete, step.id]);

  return (
    <div className={styles.card}>
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
      <Stack direction='column' alignItems='flex-start' gap={1}>
        <Stack direction='row' alignItems='center' justifyContent={'flex-start'} gap={1}>
          <span className={styles.index}>{index + 1}</span>
          <span className={styles.typeLabel}>{config.label}</span>
        </Stack>
        <div className={styles.content}>
          {ContentComponent ? (
            <ContentComponent step={step} datasource={datasource} timeRange={timeRange} onStepChange={onStepChange} />
          ) : (
            <span className={styles.placeholder}>{'Step content goes here'}</span>
          )}
        </div>
      </Stack>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  card: css`
    position: relative;
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
    width: ${theme.spacing(2)};
    height: ${theme.spacing(2)};
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
    flex-shrink: 0;
  `,
  content: css`
    flex: 1;
    min-width: 0;
  `,
  placeholder: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  controls: css`
    position: absolute;
    top: ${theme.spacing(0.5)};
    right: ${theme.spacing(0.5)};
  `,
});

PipelineStep.displayName = 'PipelineStep';

export default PipelineStep;
