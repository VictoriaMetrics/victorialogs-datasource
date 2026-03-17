import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import StepRowLayout from '../../components/StepRowLayout';

import AGGREGATE_TYPE_CONFIG from './aggregateTypeConfig';
import { AGGREGATE_TYPE, AggregateRow } from './types';

interface Props {
  row: AggregateRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: AggregateRow) => void;
  onDelete: () => void;
  queryContext?: string;
}

const AggregateRowContainer = memo(function AggregateRowContainer({
  row,
  datasource,
  timeRange,
  canDelete,
  onChange,
  onDelete,
  queryContext,
}: Props) {
  const styles = useStyles2(getStyles);
  const config = AGGREGATE_TYPE_CONFIG[row.aggregateType];
  const { ContentComponent } = config;

  const handleResultNameChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...row, resultName: e.currentTarget.value });
    },
    [onChange, row]
  );

  if (row.aggregateType === AGGREGATE_TYPE.CustomPipe) {
    return (
      <StepRowLayout
        onDelete={onDelete}
        canDelete={canDelete}
      >
        <ContentComponent row={row} onChange={onChange} datasource={datasource} timeRange={timeRange} queryContext={queryContext} />
      </StepRowLayout>
    );
  }

  return (
    <StepRowLayout
      onDelete={onDelete}
      canDelete={canDelete}
      disabledDeleteTooltip='At least one aggregate row is required'
    >
      <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
        <span className={styles.typeLabel}>{config.label}</span>
        <ContentComponent row={row} onChange={onChange} datasource={datasource} timeRange={timeRange} queryContext={queryContext} />
        <span className={styles.asLabel}>as</span>
        <AutoSizeInput
          placeholder='result name'
          defaultValue={row.resultName}
          minWidth={10}
          onCommitChange={handleResultNameChange}
        />
      </Stack>
    </StepRowLayout>
  );
});

export default AggregateRowContainer;

const getStyles = (theme: GrafanaTheme2) => ({
  typeLabel: css`
    font-weight: ${theme.typography.fontWeightMedium};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.primary};
    padding: 0 ${theme.spacing(0.5)};
    white-space: nowrap;
  `,
  asLabel: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-style: italic;
    padding: 0 ${theme.spacing(0.25)};
  `,
});
