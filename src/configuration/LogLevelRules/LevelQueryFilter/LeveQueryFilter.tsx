import React, { MouseEvent, useCallback, useMemo } from 'react';


import { LogLevel } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { useLevelQueryHintSection } from '../../../components/QueryEditor/QueryHints/hints/useLevelQueryHintSection';
import { Query } from '../../../types';
import { LogLevelRule } from '../types';

import { LevelFilterButton } from './LevelFilterButton';
import { buildQueryExprWithLevelFilters } from './utils';


interface Props {
  logLevelRules: LogLevelRule[];
  query: Query;
  onChange: (value: Query) => void;
}

export const LevelQueryFilter = ({ logLevelRules, query, onChange }: Props) => {
  const levelQueryHintSection = useLevelQueryHintSection(logLevelRules);

  const unknownLevelFilter = useMemo(() => levelQueryHintSection.hints.find(hint => hint.title === LogLevel.unknown), [levelQueryHintSection]);
  const isQueryContainUnknowFilter = unknownLevelFilter && query.expr.includes(unknownLevelFilter.queryExpr);

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>, levelQueryExpr: string, title: string) => {
    const isShiftPressed = e.shiftKey;
    const isUnknownFilter = title === LogLevel.unknown;
    const queryExpr = buildQueryExprWithLevelFilters({
      queryExpr: query.expr,
      levelQueryExpr,
      isShiftPressed,
      isQueryContainUnknowFilter,
      isUnknownFilter
    });
    onChange({ ...query, expr: queryExpr });
  }, [isQueryContainUnknowFilter, onChange, query]);

  return (
    <Stack direction={'row'} justifyContent={'flex-start'} alignItems={'center'} wrap={'wrap'}>
      {levelQueryHintSection.hints.map(({ title, queryExpr }) => {
        const isNegativeStart = query.expr.startsWith('!(');
        const isSelected = (isNegativeStart && title === LogLevel.unknown)
          || (!isNegativeStart && query.expr.includes(queryExpr));
        return (
          <LevelFilterButton
            key={title}
            onClick={(e: MouseEvent<HTMLButtonElement>) => handleClick(e, queryExpr, title)}
            level={title as LogLevel}
            label={title}
            isSelected={isSelected}
          />
        );
      })}
    </Stack>
  );
};
