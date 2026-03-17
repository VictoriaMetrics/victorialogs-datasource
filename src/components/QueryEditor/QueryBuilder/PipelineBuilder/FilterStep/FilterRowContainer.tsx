import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import StepRowLayout from '../../components/StepRowLayout';

import FILTER_TYPE_CONFIG from './filterTypeConfig';
import { FilterRow } from './types';

interface Props {
  row: FilterRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: FilterRow) => void;
  onDelete: () => void;
  queryContext?: string;
}

const FilterRowContainer = memo<Props>(({ row, datasource, timeRange, canDelete, onChange, onDelete, queryContext }) => {
  const styles = useStyles2(getStyles);
  const config = FILTER_TYPE_CONFIG[row.filterType];
  const { ContentComponent } = config;

  console.log(queryContext);
  return (
    <StepRowLayout
      onDelete={onDelete}
      canDelete={canDelete}
      disabledDeleteTooltip='At least one filter is required'
    >
      <span className={styles.typeLabel}>{config.label}</span>
      <ContentComponent row={row} onChange={onChange} datasource={datasource} timeRange={timeRange} queryContext={queryContext} />
    </StepRowLayout>
  );
});

FilterRowContainer.displayName = 'FilterRowContainer';

export default FilterRowContainer;

const getStyles = (theme: GrafanaTheme2) => ({
  typeLabel: css`
    font-weight: ${theme.typography.fontWeightMedium};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.primary};
    padding: 0 ${theme.spacing(0.5)};
    white-space: nowrap;
  `,
});
