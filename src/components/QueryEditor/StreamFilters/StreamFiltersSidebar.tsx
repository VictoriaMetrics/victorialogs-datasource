import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { CopyButton } from '../../shared/CopyButton/CopyButton';

import { StreamLabelList } from './StreamLabelList';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
  popoverLabel: string | null;
  selectedValuesForPopover: string[];
  sidebarExtraStreamFilters?: string;
  popoverExtraStreamFilters?: string;
  hasActiveFilters: boolean;
  onLabelClick: (name: string) => void;
  onToggleValue: (value: string) => void;
  onClosePopover: () => void;
  onClearAll: () => void;
}

export const StreamFiltersSidebar: React.FC<Props> = (props) => {
  const styles = useStyles2(getStyles);
  const { hasActiveFilters, onClearAll, ...listProps } = props;
  const { sidebarExtraStreamFilters } = props;

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
            onClick={onClearAll}
          />
        </Stack>
      </div>
      <StreamLabelList {...listProps} emptyText='No stream labels' />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    flex: 0 0 320px;
    max-width: 320px;
    height: 250px;
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
