import React from 'react';

import { Stack } from '@grafana/ui';

import { UNIQ_LOG_LEVEL } from '../../../../configuration/LogLevelRules/const';
import { AdHocFilter } from '../../../../types';
import { matchesLevelChip, toggleLevelChip } from '../../../../utils/query/levelChips';
import { LevelFilterButton } from '../../LevelQueryFilter/LevelFilterButton';

// the same set and order as the editor's level buttons, with unknown last
const LEVELS = Object.values(UNIQ_LOG_LEVEL);

interface LevelFilterRowProps {
  filters: AdHocFilter[];
  onFiltersChange: (filters: AdHocFilter[]) => void;
}

/**
 * Level toggle buttons that narrow the drawer by derived log level. Each button toggles a
 * marked `level` chip, which expands into the per-level LogsQL expression at query time, so
 * the selection always matches the level colors on the volume charts
 */
export const LevelFilterRow: React.FC<LevelFilterRowProps> = ({ filters, onFiltersChange }) => (
  <Stack direction='row' wrap alignItems='center'>
    {LEVELS.map((level) => (
      <LevelFilterButton
        key={level}
        level={level}
        label={level}
        isSelected={filters.some((f) => matchesLevelChip(f, level))}
        onClick={() => onFiltersChange(toggleLevelChip(filters, level))}
      />
    ))}
  </Stack>
);
