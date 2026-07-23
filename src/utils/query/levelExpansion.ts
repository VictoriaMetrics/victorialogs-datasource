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
 * Builds the `level:contains_common_case(...)` clause matching the canonical
 * alias values of the given level (shared by filter expansion and format pipes)
 */
export function buildLevelAliasClause(level: UniqLogLevelKeys): string {
  const values = possibleLogValueByLevelType[level].map((value) => `"${value}"`).join(',');
  return `level:contains_common_case(${values})`;
}

/**
 * Drops draft rules with an empty field — they would produce an unparsable
 * `:"value"` condition (shared by filter expansion and format pipes)
 */
export function usableLevelRules(rules: LogLevelRule[]): LogLevelRule[] {
  return rules.filter((rule) => rule.field);
}

const buildRuleExpr = (rule: LogLevelRule): string => OperatorLabelsQueryBuilder[rule.operator](rule);

/**
 * Builds the LogsQL expression for each log level from the given rules.
 * Pure (no React). Callers pass already-filtered (active) rules.
 * Known levels: `level:contains_common_case(<values>) OR <rule exprs>`.
 * The last entry is `unknown` = `!(<all known levels OR'd>)`.
 */
export function buildLevelExprs(rules: LogLevelRule[]): LevelExpr[] {
  const groupedByLevelRules = groupBy(usableLevelRules(rules), 'level');
  const levelFilters = Object.values(UNIQ_LOG_LEVEL)
    // `unknown` is handled separately below as the negation of all known levels and has no `possibleLogValueByLevelType` expansion of its own.
    .filter((val) => val !== LogLevel.unknown)
    .reduce((acc, logLevel) => {
      acc[logLevel] = groupedByLevelRules[logLevel] || [];
      return acc;
    }, {} as Record<UniqLogLevelKeys, LogLevelRule[]>);

  const result: LevelExpr[] = Object.entries(levelFilters).map(([ruleLevel, levelRules]) => {
    const levelKey = ruleLevel as UniqLogLevelKeys;
    const ruleExprs = levelRules.map(buildRuleExpr);
    const levelExpr = buildLevelAliasClause(levelKey);
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

// Canonical level order — must match the format-pipe emission order in levelFormatPipes.ts
const LEVEL_ORDER = Object.values(UNIQ_LOG_LEVEL);

/**
 * Builds an EXACT per-level LogsQL expression reproducing the classifier's
 * first-match-wins semantics (extractLevelFromLabels / buildLevelFormatPipes):
 * a valid `level` field value claims the row first (in canonical level order),
 * then rules apply in list order — a rule claims a row only when no earlier
 * rule of a DIFFERENT level matches it (earlier same-level rules yield the
 * same level, so they need no guard). Rows matching nothing are `unknown`.
 * The per-level sets are disjoint, so entries can be OR-combined safely.
 */
export function buildExactLevelExprMap(rules: LogLevelRule[]): Record<string, string> {
  const usable = usableLevelRules(rules);
  const ruleExprs = usable.map(buildRuleExpr);
  const anyAlias = LEVEL_ORDER.map(buildLevelAliasClause).join(' OR ');

  return LEVEL_ORDER.reduce<Record<string, string>>((acc, level, levelIdx) => {
    const parts: string[] = [];

    const earlierAliases = LEVEL_ORDER.slice(0, levelIdx).map(buildLevelAliasClause);
    parts.push(
      earlierAliases.length
        ? `(${buildLevelAliasClause(level)} and !(${earlierAliases.join(' OR ')}))`
        : buildLevelAliasClause(level)
    );

    const ruleParts = usable
      .map((rule, index) => ({ rule, index }))
      .filter(({ rule }) => rule.level === level)
      .map(({ rule, index }) => {
        const earlierOtherLevel = usable
          .slice(0, index)
          .filter((earlier) => earlier.level !== level)
          .map(buildRuleExpr);
        const own = buildRuleExpr(rule);
        return earlierOtherLevel.length ? `(${own} and !(${earlierOtherLevel.join(' OR ')}))` : own;
      });

    if (level === LogLevel.unknown && usable.length) {
      // Rows matching no rule at all also classify as unknown
      ruleParts.push(`!(${ruleExprs.join(' OR ')})`);
    }

    if (level === LogLevel.unknown && !usable.length) {
      parts.push(`!(${anyAlias})`);
    } else if (ruleParts.length) {
      parts.push(`(!(${anyAlias}) and (${ruleParts.join(' OR ')}))`);
    }

    acc[level] = parts.join(' OR ');
    return acc;
  }, {});
}
