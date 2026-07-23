import { LogLevel } from '@grafana/data';

import { LogLevelRuleType } from '../../configuration/LogLevelRules/types';

import { buildExactLevelExprMap, buildLevelAliasClause, buildLevelExprMap, buildLevelExprs, usableLevelRules } from './levelExpansion';

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

  it('escapes quotes in rule values via the shared LogsQL quoting helper', () => {
    const rules = [
      { field: 'msg', operator: LogLevelRuleType.Equals, value: 'a"b', level: LogLevel.error, enabled: true },
    ];
    expect(buildLevelExprMap(rules)[LogLevel.error]).toContain('msg:"a\\"b"');
  });

  it('skips draft rules with an empty field', () => {
    const rules = [
      { field: '', operator: LogLevelRuleType.Equals, value: 'x', level: LogLevel.error, enabled: true },
    ];
    expect(buildLevelExprMap(rules)[LogLevel.error]).not.toContain(':"x"');
  });
});

describe('shared level primitives', () => {
  it('buildLevelAliasClause builds the contains_common_case clause for a level', () => {
    expect(buildLevelAliasClause(LogLevel.error)).toMatch(/^level:contains_common_case\("err","eror","error"\)$/);
  });

  it('usableLevelRules drops draft rules with an empty field', () => {
    const draft = { field: '', operator: LogLevelRuleType.Equals, value: 'x', level: LogLevel.error, enabled: true };
    const real = { field: '_msg', operator: LogLevelRuleType.Equals, value: 'x', level: LogLevel.error, enabled: true };
    expect(usableLevelRules([draft, real])).toEqual([real]);
  });
});

describe('buildExactLevelExprMap', () => {
  const loadedError = { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'Loaded', level: LogLevel.error, enabled: true };
  const creatingWarn = { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'Creating', level: LogLevel.warning, enabled: true };
  const creatingInfo = { field: '_msg', operator: LogLevelRuleType.Regex, value: 'Creating', level: LogLevel.info, enabled: true };

  it('guards a rule with the negation of earlier rules of other levels (first-match-wins)', () => {
    const map = buildExactLevelExprMap([creatingWarn, creatingInfo]);
    expect(map[LogLevel.info]).toContain('(_msg:~"Creating" and !(_msg:"Creating"))');
  });

  it('does not guard against earlier rules of the same level', () => {
    const deletedError = { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'Deleted', level: LogLevel.error, enabled: true };
    const map = buildExactLevelExprMap([loadedError, deletedError]);
    expect(map[LogLevel.error]).toContain('_msg:"Deleted"');
    expect(map[LogLevel.error]).not.toContain('_msg:"Deleted" and');
  });

  it('guards the alias clause with the negation of earlier levels in canonical order', () => {
    const map = buildExactLevelExprMap([loadedError]);
    expect(map[LogLevel.critical].startsWith('level:contains_common_case(')).toBe(true);
    expect(map[LogLevel.error]).toContain('(level:contains_common_case("err","eror","error") and !(level:contains_common_case(');
  });

  it('guards the rules section with the negation of every alias clause', () => {
    const map = buildExactLevelExprMap([loadedError]);
    const rulesSection = map[LogLevel.error].split(' OR (!(')[1];
    expect(rulesSection).toBeDefined();
    expect(rulesSection).toContain('_msg:"Loaded"');
    // all 7 alias groups are negated before any rule applies
    expect((map[LogLevel.error].match(/contains_common_case/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('unknown covers the unknown alias, unknown-level rules, and rows matching no rule', () => {
    const noiseUnknown = { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'noise', level: LogLevel.unknown, enabled: true };
    const map = buildExactLevelExprMap([loadedError, noiseUnknown]);
    expect(map[LogLevel.unknown]).toContain('level:contains_common_case("unknown")');
    expect(map[LogLevel.unknown]).toContain('(_msg:"noise" and !(_msg:"Loaded"))');
    expect(map[LogLevel.unknown]).toContain('!(_msg:"Loaded" OR _msg:"noise")');
  });

  it('with no rules a known level is its guarded alias clause and unknown catches everything else', () => {
    const map = buildExactLevelExprMap([]);
    expect(map[LogLevel.critical]).toBe('level:contains_common_case("emerg","fatal","alert","crit","critical")');
    expect(map[LogLevel.info]).not.toContain(' and (');
    expect(map[LogLevel.unknown]).toMatch(/ OR !\(level:contains_common_case\(/);
  });

  it('skips draft rules with an empty field', () => {
    const draft = { field: '', operator: LogLevelRuleType.Equals, value: 'x', level: LogLevel.error, enabled: true };
    const map = buildExactLevelExprMap([draft]);
    expect(map[LogLevel.error]).not.toContain(':"x"');
  });
});
