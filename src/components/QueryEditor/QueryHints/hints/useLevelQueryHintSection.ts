import { useMemo } from 'react';

import { LogLevelRule } from '../../../../configuration/LogLevelRules/types';
import { buildLevelExprs } from '../../../../utils/query/levelExpansion';

import { QueryHint, QueryHintSectionBase } from './types';

type LevelHint = Pick<QueryHint, 'title' | 'queryExpr'>;

export const useLevelQueryHintSection = (levelRules: LogLevelRule[]): QueryHintSectionBase<LevelHint> => {
  return useMemo(() => {
    const enabledLevelRules = levelRules.filter((rule) => rule.enabled);
    const hints: LevelHint[] = buildLevelExprs(enabledLevelRules).map(({ level, expr }) => ({
      title: level,
      queryExpr: expr,
    }));
    return {
      title: 'Filter by log level',
      hints,
    };
  }, [levelRules]);
};
