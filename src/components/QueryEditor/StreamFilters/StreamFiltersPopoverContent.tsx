import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';

import { SelectedStreamFiltersChips } from './SelectedStreamFiltersChips';
import { useStreamFiltersContext } from './StreamFiltersContext';
import { StreamLabelList } from './StreamLabelList';
import { StreamValuesPanel } from './StreamValuesPanel';

const POPOVER_WIDTH = 740;
const COLUMNS_PREFERRED_HEIGHT = 340;
const COLUMNS_MIN_HEIGHT = 180;
const LABELS_COL_WIDTH = 320;
const VIEWPORT_RESERVE = 100;
const FOOTER_MAX_HEIGHT = 350;

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
}

export const StreamFiltersPopoverContent: React.FC<Props> = ({
  datasource,
  timeRange,
  queryExpr,
}) => {
  const styles = useStyles2(getStyles);
  const { popoverLabel, streamFilters, clearAll } = useStreamFiltersContext();
  const hasFilters = streamFilters.length > 0;

  return (
    <div className={styles.root}>
      <div className={hasFilters ? styles.columnsWithFooter : styles.columns}>
        <div className={styles.leftColumn}>
          <StreamLabelList
            datasource={datasource}
            timeRange={timeRange}
            queryExpr={queryExpr}
            emptyText='No stream labels'
          />
        </div>
        <div className={styles.rightColumn}>
          {popoverLabel ? (
            <StreamValuesPanel
              key={popoverLabel}
              datasource={datasource}
              timeRange={timeRange}
              queryExpr={queryExpr}
              label={popoverLabel}
            />
          ) : (
            <div className={styles.emptyHint}>Select a field on the left</div>
          )}
        </div>
      </div>
      {hasFilters && (
        <div className={styles.footer}>
          <div className={styles.footerScroll}>
            <SelectedStreamFiltersChips />
          </div>
          <div className={styles.clearButton}>
            <IconButton
              name='trash-alt'
              size='sm'
              tooltip='Clear all stream filters'
              aria-label='Clear all stream filters'
              onClick={clearAll}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  root: css`
    width: ${POPOVER_WIDTH}px;
    max-height: calc(100vh - ${VIEWPORT_RESERVE}px);
    display: flex;
    flex-direction: column;
    // Pull against the Toggletip's built-in padding so the visible gap
    // between the Toggletip border and our content is ~4px.
    margin: -20px -12px;
  `,
  columns: css`
    flex: 0 1 ${COLUMNS_PREFERRED_HEIGHT}px;
    min-height: ${COLUMNS_MIN_HEIGHT}px;
    display: flex;
    overflow: hidden;
  `,
  columnsWithFooter: css`
    flex: 0 1 ${COLUMNS_PREFERRED_HEIGHT}px;
    min-height: ${COLUMNS_MIN_HEIGHT}px;
    display: flex;
    overflow: hidden;
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  leftColumn: css`
    width: ${LABELS_COL_WIDTH}px;
    flex: 0 0 ${LABELS_COL_WIDTH}px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid ${theme.colors.border.weak};
  `,
  rightColumn: css`
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  `,
  emptyHint: css`
    padding: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  footer: css`
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: ${FOOTER_MAX_HEIGHT}px;
    position: relative;
    background: ${theme.colors.background.secondary};
  `,
  footerScroll: css`
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow-y: auto;
    padding: ${theme.spacing(1)};
    padding-right: ${theme.spacing(4)};
  `,
  clearButton: css`
    position: absolute;
    top: ${theme.spacing(0.5)};
    right: ${theme.spacing(1.5)};
    z-index: 1;
  `,
});
