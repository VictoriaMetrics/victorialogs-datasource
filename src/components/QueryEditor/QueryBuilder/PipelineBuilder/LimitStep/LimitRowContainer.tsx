import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import StepRowLayout from '../../components/StepRowLayout';

import LIMIT_TYPE_CONFIG from './limitTypeConfig';
import { LimitRow } from './types';

interface Props {
  row: LimitRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: LimitRow) => void;
  onDelete: () => void;
}

const LimitRowContainer = memo(function LimitRowContainer({
  row,
  datasource,
  timeRange,
  canDelete,
  onChange,
  onDelete,
}: Props) {
  const styles = useStyles2(getStyles);
  const config = LIMIT_TYPE_CONFIG[row.limitType];
  const { ContentComponent } = config;

  return (
    <StepRowLayout
      onDelete={onDelete}
      canDelete={canDelete}
      disabledDeleteTooltip='At least one limit row is required'
    >
      <span className={styles.typeLabel}>{config.label}</span>
      <ContentComponent row={row} onChange={onChange} datasource={datasource} timeRange={timeRange} />
    </StepRowLayout>
  );
});

export default LimitRowContainer;

const getStyles = (theme: GrafanaTheme2) => ({
  typeLabel: css`
    font-weight: ${theme.typography.fontWeightMedium};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.primary};
    padding: 0 ${theme.spacing(0.5)};
    white-space: nowrap;
  `,
});
