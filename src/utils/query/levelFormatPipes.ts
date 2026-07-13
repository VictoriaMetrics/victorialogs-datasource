import { LogLevel } from '@grafana/data';

import { OperatorLabelsQueryBuilder, UNIQ_LOG_LEVEL } from '../../configuration/LogLevelRules/const';
import { LogLevelRule } from '../../configuration/LogLevelRules/types';

import { buildLevelAliasClause, usableLevelRules } from './levelExpansion';

/**
 * Field name derived by the generated `format` pipes; unique enough to avoid
 * clashing with real ingested fields or user pipes
 */
export const DERIVED_LEVEL_FIELD = '__vl_ds_level';

const derivedLevelValues = new Set<string>(Object.values(UNIQ_LOG_LEVEL));

const guardedFormatPipe = (condition: string, level: string): string =>
  `format if ((${condition}) and ${DERIVED_LEVEL_FIELD}:"") "${level}" as ${DERIVED_LEVEL_FIELD}`;

/**
 * Builds conditional `format` pipes that derive the log level server-side.
 * Pipe order mirrors the client matcher (`extractLevelFromLabels`): a valid
 * `level` field value wins first, then rules apply in list order. Each pipe is
 * guarded with `and __vl_ds_level:""` to keep first-match-wins semantics under
 * last-write-wins `format` pipes. Returns an empty string when no rules exist,
 * so callers keep the lightweight `field=level` request.
 */
export function buildLevelFormatPipes(rules: LogLevelRule[]): string {
  const usableRules = usableLevelRules(rules);
  if (!usableRules.length) {
    return '';
  }

  const resetPipe = `format "" as ${DERIVED_LEVEL_FIELD}`;

  const levelFieldPipes = Object.values(UNIQ_LOG_LEVEL).map((level) =>
    guardedFormatPipe(buildLevelAliasClause(level), level)
  );

  const rulePipes = usableRules.map((rule) => guardedFormatPipe(OperatorLabelsQueryBuilder[rule.operator](rule), rule.level));

  return [resetPipe, ...levelFieldPipes, ...rulePipes].map((pipe) => ` | ${pipe}`).join('');
}

/**
 * Maps a derived level label value back to a LogLevel; empty or foreign values become unknown
 */
export function parseDerivedLevel(value: string): LogLevel {
  return derivedLevelValues.has(value) ? (value as LogLevel) : LogLevel.unknown;
}

/** How a hits query splits its volume by log level (see buildLevelGrouping) */
export interface LevelGrouping {
  /** Format pipes deriving the level server-side; empty when no usable rules exist */
  pipes: string;
  /** The level grouping fields: the single derived field, or the raw `level` without rules */
  fields: string[];
}

/**
 * Resolves the level-splitting recipe for a hits query. With usable rules the
 * level is derived server-side via `format` pipes and hits group by the single
 * derived field — grouping by every raw rule field instead would lose the
 * classifier's first-match-wins semantics and explode the tuple space (a `_msg`
 * rule can't be grouped at all). Without rules the lightweight `field=level`
 * request needs no pipes.
 */
export function buildLevelGrouping(rules: LogLevelRule[]): LevelGrouping {
  const pipes = buildLevelFormatPipes(rules);
  return { pipes, fields: pipes ? [DERIVED_LEVEL_FIELD] : ['level'] };
}
