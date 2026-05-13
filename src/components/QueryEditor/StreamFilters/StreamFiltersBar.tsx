import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { IconButton, Toggletip, ToolbarButton, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { CopyButton } from '../../shared/CopyButton/CopyButton';

import { SelectedStreamFiltersChips } from './SelectedStreamFiltersChips';
import { useStreamFiltersContext } from './StreamFiltersContext';
import { StreamFiltersPopoverContent } from './StreamFiltersPopoverContent';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
}

export const StreamFiltersBar: React.FC<Props> = ({
  datasource,
  timeRange,
  queryExpr,
}) => {
  const styles = useStyles2(getStyles);
  const { streamFilters, selectedExtraStreamFilters, clearAll, closePopover } =
    useStreamFiltersContext();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasFilters = streamFilters.length > 0;

  // Toggletip applies its own onClick to the trigger via cloneElement, so we
  // can't use a custom onClick on ToolbarButton — sync via onOpen/onClose.
  const handlePopoverOpen = useCallback(() => {
    setPopoverOpen(true);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setPopoverOpen(false);
    closePopover();
  }, [closePopover]);

  return (
    <div className={styles.bar}>
      <div className={styles.topRow}>
        <Toggletip
          placement='bottom-start'
          show={popoverOpen}
          onOpen={handlePopoverOpen}
          onClose={handlePopoverClose}
          closeButton={false}
          fitContent
          content={
            <StreamFiltersPopoverContent
              datasource={datasource}
              timeRange={timeRange}
              queryExpr={queryExpr}
            />
          }
        >
          <ToolbarButton
            icon='filter'
            isOpen={popoverOpen}
            aria-label='Stream filters'
          >
            Stream filters
          </ToolbarButton>
        </Toggletip>
        {hasFilters && (
          <>
            <CopyButton
              text={selectedExtraStreamFilters}
              tooltip='Copy stream filters as LogsQL'
              aria-label='Copy stream filters as LogsQL'
              successMessage='Stream filters copied to clipboard'
              errorMessage='Failed to copy stream filters'
            />
            <IconButton
              name='trash-alt'
              size='sm'
              tooltip='Clear all stream filters'
              aria-label='Clear all stream filters'
              onClick={clearAll}
            />
          </>
        )}
      </div>
      <SelectedStreamFiltersChips />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)};
    margin-top: ${theme.spacing(0.5)};
  `,
  topRow: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.spacing(0.5)};
  `,
});
