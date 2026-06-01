import { groupBy } from 'lodash';

import { LogLevel } from '@grafana/data';

import {
  OperatorLabelsQueryBuilder,
  possibleLogValueByLevelType,
  UNIQ_LOG_LEVEL,
  UniqLogLevelKeys,
} from '../../configuration/LogLevelRules/const';
import { LogLevelRule } from '../../configuration/LogLevelRules/types';

export interface LevelExpr {
  level: UniqLogLevelKeys;
  expr: string;
}

/**
 * Builds the LogsQL expression for each log level from the given rules.
 * Pure (no React). Callers pass already-filtered (active) rules.
 * Known levels: `level:contains_common_case(<values>) OR <rule exprs>`.
 * The last entry is `unknown` = `!(<all known levels OR'd>)`.
 */
export function buildLevelExprs(rules: LogLevelRule[]): LevelExpr[] {
  const groupedByLevelRules = groupBy(rules, 'level');
  const levelFilters = Object.values(UNIQ_LOG_LEVEL)
    // `unknown` is handled separately below as the negation of all known levels and has no `possibleLogValueByLevelType` expansion of its own.
    .filter((val) => val !== LogLevel.unknown)
    .reduce((acc, logLevel) => {
      acc[logLevel] = groupedByLevelRules[logLevel] || [];
      return acc;
    }, {} as Record<UniqLogLevelKeys, LogLevelRule[]>);

  const buildRuleExpr = (rule: LogLevelRule) => OperatorLabelsQueryBuilder[rule.operator](rule);

  const result: LevelExpr[] = Object.entries(levelFilters).map(([ruleLevel, levelRules]) => {
    const levelKey = ruleLevel as UniqLogLevelKeys;
    const ruleExprs = levelRules.map(buildRuleExpr);
    const possibleLevelValues = possibleLogValueByLevelType[levelKey].map((value) => `"${value}"`).join(',');
    const levelExpr = `level:contains_common_case(${possibleLevelValues})`;
    return { level: levelKey, expr: [levelExpr, ...ruleExprs].join(' OR ') };
  });

  result.push({
    level: LogLevel.unknown,
    expr: `!(${result.map((r) => r.expr).join(' OR ')})`,
  });

  return result;
}

export function buildLevelExprMap(rules: LogLevelRule[]): Record<string, string> {
  return buildLevelExprs(rules).reduce<Record<string, string>>((acc, { level, expr }) => {
    acc[level] = expr;
    return acc;
  }, {});
}
