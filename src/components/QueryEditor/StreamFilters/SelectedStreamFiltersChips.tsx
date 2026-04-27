import React from 'react';

import { Stack } from '@grafana/ui';

import { StreamFilterState } from '../../../types';
import { Chip } from '../../shared/Chip/Chip';

interface Props {
  filters: StreamFilterState[];
  onRemoveValue: (filterIndex: number, value: string) => void;
}

export const SelectedStreamFiltersChips: React.FC<Props> = ({ filters, onRemoveValue }) => {
  const rows = filters.flatMap((filter, filterIndex) =>
    filter.label && filter.values.length > 0
      ? filter.values.map((value) => ({ filterIndex, label: filter.label, value }))
      : []
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <Stack wrap='wrap' gap={0.5} >
      {rows.map(({ filterIndex, label, value }) => (
        <Chip
          key={`${label}:${value}`}
          label={label}
          value={value}
          onRemove={() => onRemoveValue(filterIndex, value)}
        />
      ))}
    </Stack>
  );
};
