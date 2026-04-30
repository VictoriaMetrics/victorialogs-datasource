import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { Chip } from '../../shared/Chip/Chip';
import { CopyButton } from '../../shared/CopyButton/CopyButton';

import { useStreamFiltersContext } from './StreamFiltersContext';

export const SelectedStreamFiltersChips: React.FC = () => {
  const styles = useStyles2(getStyles);
  const {
    streamFilters,
    sidebarExtraStreamFilters,
    handleRemoveValue,
    clearAll,
  } = useStreamFiltersContext();

  const rows = streamFilters.flatMap((filter, filterIndex) =>
    filter.label && filter.values.length > 0
      ? filter.values.map((value) => ({ filterIndex, label: filter.label, value }))
      : []
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Stack wrap='wrap' gap={0.5} >
        {rows.map(({ filterIndex, label, value }) => (
          <Chip
            key={`${label}:${value}`}
            label={label}
            value={value}
            onRemove={() => handleRemoveValue(filterIndex, value)}
          />
        ))}
      </Stack>
      <Stack gap={0.5}>
        <CopyButton
          text={sidebarExtraStreamFilters}
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
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin-top: ${theme.spacing(1)};
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${theme.spacing(1)};
  `,
});
