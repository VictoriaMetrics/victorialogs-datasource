import React from 'react';

import { Stack } from '@grafana/ui';

import { streamFilterOperator } from '../../../utils/query/streamFilterToggle';
import { GroupedChip } from '../../shared/Chip/GroupedChip';
import { StreamBadge } from '../../shared/Chip/StreamBadge';

import { useStreamFiltersContext } from './StreamFiltersContext';

export const SelectedStreamFiltersChips: React.FC = () => {
  const { streamFilters, handleRemoveValue, handleRemoveFilter, moveFilterToQuery } = useStreamFiltersContext();

  const groups = streamFilters
    .map((filter, filterIndex) => ({ filterIndex, filter }))
    .filter(({ filter }) => filter.label && filter.values.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <Stack wrap='wrap' gap={0.5}>
      {groups.map(({ filterIndex, filter }) => {
        const operator = streamFilterOperator(filter);
        return (
          <GroupedChip
            key={`${filter.label}|${operator}`}
            leading={<StreamBadge />}
            label={operator === 'not_in' ? `${filter.label} :!` : `${filter.label} :`}
            values={filter.values}
            onRemoveValue={(value) => handleRemoveValue(filterIndex, value)}
            onRemoveAll={() => handleRemoveFilter(filterIndex)}
            actions={[
              {
                icon: 'arrow-down',
                onClick: () => moveFilterToQuery(filterIndex),
                ariaLabel: 'Move to query',
                tooltip: 'Move to query',
              },
            ]}
          />
        );
      })}
    </Stack>
  );
};
