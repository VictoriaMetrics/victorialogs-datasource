import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Icon, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { ResizeHandle } from '../../shared/ResizeHandle/ResizeHandle';

import { StreamLabelList } from './StreamLabelList';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
  width: number;
  onResize: (width: number) => void;
  onCollapse: () => void;
}

export const StreamFiltersSidebar: React.FC<Props> = ({
  datasource,
  timeRange,
  queryExpr,
  width,
  onResize,
  onCollapse,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper} style={{ flex: `0 0 ${width}px`, width: `${width}px` }}>
      <div className={styles.header}>
        <Stack gap={0.5} alignItems={'center'}>
          <Icon name='filter' size='sm' />
          <span>Stream filters</span>
        </Stack>
        <IconButton
          className={styles.collapseButton}
          name='arrow-from-right'
          size='sm'
          tooltip='Hide stream filters'
          aria-label='Hide stream filters'
          onClick={onCollapse}
        />
      </div>
      <StreamLabelList
        datasource={datasource}
        timeRange={timeRange}
        queryExpr={queryExpr}
        emptyText='No stream labels'
      />
      <ResizeHandle
        currentWidth={width}
        onResize={onResize}
        ariaLabel='Resize stream filters sidebar'
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
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
  `,
  collapseButton: css`
    transform: rotate(180deg);
  `,
});
