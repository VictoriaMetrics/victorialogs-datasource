import React from 'react';

import { Stack } from '@grafana/ui';

import { GroupedChip } from '../../shared/Chip/GroupedChip';

import { useStreamFiltersContext } from './StreamFiltersContext';

export const SelectedStreamFiltersChips: React.FC = () => {
  const { streamFilters, handleRemoveValue, handleRemoveFilter } = useStreamFiltersContext();

  const groups = streamFilters
    .map((filter, filterIndex) => ({ filterIndex, filter }))
    .filter(({ filter }) => filter.label && filter.values.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <Stack wrap='wrap' gap={0.5}>
      {groups.map(({ filterIndex, filter }) => (
        <GroupedChip
          key={filter.label}
          label={filter.label}
          values={filter.values}
          onRemoveValue={(value) => handleRemoveValue(filterIndex, value)}
          onRemoveAll={() => handleRemoveFilter(filterIndex)}
        />
      ))}
    </Stack>
  );
};
