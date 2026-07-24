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
 * Builds the expression claiming rows for `level` via its rules, guarded by the
 * first-match-wins semantics: a rule claims a row only when no EARLIER rule of a
 * different level matches it. Instead of inlining the full guard per rule (which
 * grows quadratically with the rule count), guards are factored into a nested
 * chain — `own1 OR (own2 and !(earlier others))` — built back-to-front, so every
 * rule expression appears exactly once and the result stays linear in size.
 * Returns null when the level has no rules.
 */
const buildGuardedRuleChain = (rules: LogLevelRule[], level: UniqLogLevelKeys): string | null => {
  let chain: string | null = null;
  // `and` binds tighter than `OR` in LogsQL — an OR chain must be parenthesized before guarding
  let chainHasTopLevelOr = false;
  // Other-level rules seen between the current position and the next own rule
  let pendingGuards: string[] = [];

  const guardChain = () => {
    if (chain !== null && pendingGuards.length) {
      const guarded = chainHasTopLevelOr ? `(${chain})` : chain;
      chain = `(${guarded} and !(${pendingGuards.join(' OR ')}))`;
      chainHasTopLevelOr = false;
    }
  };

  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (rule.level !== level) {
      pendingGuards.unshift(buildRuleExpr(rule));
      continue;
    }
    guardChain();
    // Rules after the LAST own rule guard nothing for this level — drop them
    pendingGuards = [];
    if (chain === null) {
      chain = buildRuleExpr(rule);
    } else {
      chain = `${buildRuleExpr(rule)} OR ${chain}`;
      chainHasTopLevelOr = true;
    }
  }

  guardChain();
  return chain;
};

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

    const ruleChain = buildGuardedRuleChain(usable, level);
    const ruleParts = ruleChain === null ? [] : [ruleChain];

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
