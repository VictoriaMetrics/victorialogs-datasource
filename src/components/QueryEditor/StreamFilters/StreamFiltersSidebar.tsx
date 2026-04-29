import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { CopyButton } from '../../shared/CopyButton/CopyButton';

import { useStreamFiltersContext } from './StreamFiltersContext';
import { StreamLabelList } from './StreamLabelList';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
}

export const StreamFiltersSidebar: React.FC<Props> = ({ datasource, timeRange, queryExpr }) => {
  const styles = useStyles2(getStyles);
  const { streamFilters, sidebarExtraStreamFilters, clearAll } = useStreamFiltersContext();
  const hasActiveFilters = streamFilters.length > 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Stack gap={0.5} alignItems={'center'}>
          <Icon name='filter' size='sm' />
          <span>Stream filters</span>
        </Stack>
        <Stack gap={0.5}>
          <CopyButton
            text={sidebarExtraStreamFilters}
            tooltip='Copy as LogsQL'
            aria-label='Copy stream filters as LogsQL'
            disabled={!hasActiveFilters}
            successMessage='Stream filters copied to clipboard'
            errorMessage='Failed to copy stream filters'
          />
          <IconButton
            name='trash-alt'
            size='sm'
            tooltip='Clear all stream filters'
            aria-label='Clear all stream filters'
            disabled={!hasActiveFilters}
            onClick={clearAll}
          />
        </Stack>
      </div>
      <StreamLabelList
        datasource={datasource}
        timeRange={timeRange}
        queryExpr={queryExpr}
        emptyText='No stream labels'
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    flex: 0 0 280px;
    width: 280px;
    min-width: 0;
    max-width: 320px;
    height: 230px;
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    overflow: hidden;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(0.75, 1)};
    border-bottom: 1px solid ${theme.colors.border.weak};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.text.secondary};
  `
});
