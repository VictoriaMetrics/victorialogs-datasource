import { LogLevel } from '@grafana/data';

import { LogLevelRuleType } from '../../configuration/LogLevelRules/types';

import { buildLevelExprMap, buildLevelExprs } from './levelExpansion';

describe('buildLevelExprs', () => {
  it('builds an expr per known level plus unknown last', () => {
    const levels = buildLevelExprs([]).map((e) => e.level);
    expect(levels).toContain(LogLevel.error);
    expect(levels).toContain(LogLevel.info);
    expect(levels[levels.length - 1]).toBe(LogLevel.unknown);
  });

  it('uses contains_common_case for each known level', () => {
    const map = buildLevelExprMap([]);
    expect(map[LogLevel.error]).toMatch(/^level:contains_common_case\(.+\)$/);
  });

  it('builds unknown as the negation of all known levels', () => {
    const map = buildLevelExprMap([]);
    expect(map[LogLevel.unknown]).toMatch(/^!\(.+ OR .+\)$/);
  });

  it('appends matching rule expressions with OR', () => {
    const rules = [
      { field: 'log.level', operator: LogLevelRuleType.Equals, value: 'err', level: LogLevel.error, enabled: true },
    ];
    expect(buildLevelExprMap(rules)[LogLevel.error]).toContain(' OR log.level:"err"');
  });

  it('does not filter by enabled (caller pre-filters)', () => {
    const rules = [
      { field: 'log.level', operator: LogLevelRuleType.Equals, value: 'err', level: LogLevel.error, enabled: false },
    ];
    expect(buildLevelExprMap(rules)[LogLevel.error]).toContain(' OR log.level:"err"');
  });

  it('emits field:"" for an empty WordFilter (matches empty/missing fields, mirrors LogsQL)', () => {
    const rules = [
      { field: 'message', operator: LogLevelRuleType.WordFilter, value: '', level: LogLevel.error, enabled: true },
    ];
    expect(buildLevelExprMap(rules)[LogLevel.error]).toContain(' OR message:""');
  });

  it('includes WordFilter rules with a non-empty value', () => {
    const rules = [
      { field: 'message', operator: LogLevelRuleType.WordFilter, value: 'error', level: LogLevel.error, enabled: true },
    ];
    expect(buildLevelExprMap(rules)[LogLevel.error]).toContain(' OR message:"error"');
  });
});
