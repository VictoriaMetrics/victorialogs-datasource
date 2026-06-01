import React, { useCallback } from 'react';

import { LogLevel } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { LogLevelRule } from '../../../configuration/LogLevelRules/types';
import { AdHocFilter, Query } from '../../../types';
import { useLevelQueryHintSection } from '../QueryHints';

import { LevelFilterButton } from './LevelFilterButton';

const LEVEL_KEY = 'level';

interface Props {
  logLevelRules: LogLevelRule[];
  query: Query;
  onChange: (value: Query) => void;
  onRunQuery: () => void;
}

const matchesLevelChip = (f: AdHocFilter, level: string): boolean =>
  f.key === LEVEL_KEY && f.operator === '=' && f.value === level && f.fromLevelFilter === true;

export const LevelQueryFilter = ({ logLevelRules, query, onChange, onRunQuery }: Props) => {
  const levelQueryHintSection = useLevelQueryHintSection(logLevelRules);

  const isSelected = useCallback(
    (level: string) => (query.adHocFilters ?? []).some((f) => matchesLevelChip(f, level)),
    [query.adHocFilters]
  );

  const handleClick = useCallback(
    (level: string) => {
      const current = query.adHocFilters ?? [];
      const exists = current.some((f) => matchesLevelChip(f, level));
      const next: AdHocFilter[] = exists
        ? current.filter((f) => !matchesLevelChip(f, level))
        : [...current, { key: LEVEL_KEY, operator: '=', value: level, fromLevelFilter: true }];
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
