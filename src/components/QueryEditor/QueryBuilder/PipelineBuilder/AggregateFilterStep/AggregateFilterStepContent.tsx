import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { AggregateFilterStep, PipelineStepItem, PipelineStepPatch } from '../types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  onDeleteStep: (id: string) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const AggregateFilterStepContent = memo(function AggregateFilterStepContent({
  step,
  onStepChange,
}: Props) {
  const styles = useStyles2(getStyles);

  const handleConditionChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onStepChange(step.id, { condition: e.currentTarget.value });
    },
    [onStepChange, step.id]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center'>
      <span className={styles.label}>filter</span>
      <AutoSizeInput
        placeholder='e.g. logs_count:> 1000'
        defaultValue={(step as AggregateFilterStep).condition ?? ''}
        minWidth={20}
        onCommitChange={handleConditionChange}
      />
    </Stack>
  );
});

export default AggregateFilterStepContent;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    font-weight: ${theme.typography.fontWeightMedium};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.primary};
    padding: 0 ${theme.spacing(0.5)};
    white-space: nowrap;
  `,
});
