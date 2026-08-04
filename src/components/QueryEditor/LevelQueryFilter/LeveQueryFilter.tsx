import React, { useCallback } from 'react';

import { LogLevel } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { LogLevelRule } from '../../../configuration/LogLevelRules/types';
import { Query } from '../../../types';
import { matchesLevelChip, toggleLevelChip } from '../../../utils/query/levelChips';
import { useLevelQueryHintSection } from '../QueryHints';

import { LevelFilterButton } from './LevelFilterButton';

interface Props {
  logLevelRules: LogLevelRule[];
  query: Query;
  onChange: (value: Query) => void;
  onRunQuery: () => void;
}

export const LevelQueryFilter = ({ logLevelRules, query, onChange, onRunQuery }: Props) => {
  const levelQueryHintSection = useLevelQueryHintSection(logLevelRules);

  const isSelected = useCallback(
    (level: string) => (query.adHocFilters ?? []).some((f) => matchesLevelChip(f, level)),
    [query.adHocFilters]
  );

  const handleClick = useCallback(
    (level: string) => {
      const next = toggleLevelChip(query.adHocFilters ?? [], level);
      onChange({ ...query, adHocFilters: next.length ? next : undefined });
      onRunQuery();
    },
    [onChange, onRunQuery, query]
  );

  return (
    <Stack direction={'row'} justifyContent={'flex-start'} alignItems={'center'} wrap={'wrap'}>
      {levelQueryHintSection.hints.map(({ title }) => (
        <LevelFilterButton
          key={title}
          onClick={() => handleClick(title)}
          level={title as LogLevel}
          label={title}
          isSelected={isSelected(title)}
        />
      ))}
    </Stack>
  );
};
