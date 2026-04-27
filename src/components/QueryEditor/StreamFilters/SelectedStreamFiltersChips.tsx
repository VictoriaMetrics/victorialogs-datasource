import React from 'react';

import { Stack } from '@grafana/ui';

import { Chip } from '../../shared/Chip/Chip';

import { useStreamFiltersContext } from './StreamFiltersContext';

export const SelectedStreamFiltersChips: React.FC = () => {
  const { streamFilters, handleRemoveValue } = useStreamFiltersContext();

  const rows = streamFilters.flatMap((filter, filterIndex) =>
    filter.label && filter.values.length > 0
      ? filter.values.map((value) => ({ filterIndex, label: filter.label, value }))
      : []
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <Stack wrap='wrap' gap={0.5}>
      {rows.map(({ filterIndex, label, value }) => (
        <Chip
          key={`${label}:${value}`}
          label={label}
          value={value}
          onRemove={() => handleRemoveValue(filterIndex, value)}
        />
      ))}
    </Stack>
  );
};
