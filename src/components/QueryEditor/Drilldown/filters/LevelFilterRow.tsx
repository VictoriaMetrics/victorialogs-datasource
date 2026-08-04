import React from 'react';

import { Stack } from '@grafana/ui';

import { UNIQ_LOG_LEVEL } from '../../../../configuration/LogLevelRules/const';
import { AdHocFilter } from '../../../../types';
import { matchesLevelChip, toggleLevelChip } from '../../../../utils/query/levelChips';
import { LevelFilterButton } from '../../LevelQueryFilter/LevelFilterButton';

// Same set and order as the editor's level buttons: critical..trace with unknown last
const LEVELS = Object.values(UNIQ_LOG_LEVEL);

interface LevelFilterRowProps {
  filters: AdHocFilter[];
  onFiltersChange: (filters: AdHocFilter[]) => void;
}

/**
 * Row of level toggle buttons narrowing the drawer by derived log level.
 * Each button toggles a marked `level` chip in the drawer's filter list; the
 * chip expands into the exact per-level LogsQL expression at query time, so
 * the selection always agrees with the level colors on the volume charts.
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
