import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import StepRowLayout from '../../components/StepRowLayout';

import MODIFY_TYPE_CONFIG from './modifyTypeConfig';
import { ModifyRow } from './types';

interface Props {
  row: ModifyRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: ModifyRow) => void;
  onDelete: () => void;
}

const ModifyRowContainer = memo(function ModifyRowContainer({
  row,
  datasource,
  timeRange,
  canDelete,
  onChange,
  onDelete,
}: Props) {
  const styles = useStyles2(getStyles);
  const config = MODIFY_TYPE_CONFIG[row.modifyType];
  const { ContentComponent } = config;

  return (
    <StepRowLayout
      onDelete={onDelete}
      canDelete={canDelete}
      disabledDeleteTooltip='At least one modify row is required'
    >
      <span className={styles.typeLabel}>{config.label}</span>
      <ContentComponent row={row} onChange={onChange} datasource={datasource} timeRange={timeRange} />
    </StepRowLayout>
  );
});

export default ModifyRowContainer;

const getStyles = (theme: GrafanaTheme2) => ({
  typeLabel: css`
    font-weight: ${theme.typography.fontWeightMedium};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.primary};
    padding: 0 ${theme.spacing(0.5)};
    white-space: nowrap;
  `,
});
