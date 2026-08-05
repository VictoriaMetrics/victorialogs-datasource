import { LogLevel } from '@grafana/data';

import { LOG_LEVEL_OPTIONS, OperatorLabelsQueryBuilder } from './const';
import { LogLevelRule, LogLevelRuleType } from './types';

const makeRule = (operator: LogLevelRuleType, value: string | number, field = 'severity'): LogLevelRule => ({
  field,
  operator,
  value,
  level: LogLevel.error,
  enabled: true,
});

describe('OperatorLabelsQueryBuilder', () => {
  it('builds Equals as the exact filter `:=` (strict equality, like the client matcher)', () => {
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.Equals](makeRule(LogLevelRuleType.Equals, 'api'))).toBe(
      'severity:="api"'
    );
  });

  it('builds NotEquals as the negated exact filter `:!=`', () => {
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.NotEquals](makeRule(LogLevelRuleType.NotEquals, 'api'))).toBe(
      'severity:!="api"'
    );
  });

  it('builds CaseInsensitiveEquals as contains_common_case with a Title-Case value', () => {
    const rule = makeRule(LogLevelRuleType.CaseInsensitiveEquals, 'info');
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.CaseInsensitiveEquals](rule)).toBe(
      'severity:contains_common_case("Info")'
    );
  });

  it('builds WordFilter as the phrase filter', () => {
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.WordFilter](makeRule(LogLevelRuleType.WordFilter, 'error'))).toBe(
      'severity:"error"'
    );
  });

  it('builds Regex, LessThan and GreaterThan with quoted values', () => {
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.Regex](makeRule(LogLevelRuleType.Regex, 'env.*'))).toBe(
      'severity:~"env.*"'
    );
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.LessThan](makeRule(LogLevelRuleType.LessThan, 9))).toBe(
      'severity:<"9"'
    );
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.GreaterThan](makeRule(LogLevelRuleType.GreaterThan, 9))).toBe(
      'severity:>"9"'
    );
  });

  it('quotes field names containing characters that clash with the query syntax', () => {
    const rule = makeRule(LogLevelRuleType.Equals, 'error', 'log:level');
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.Equals](rule)).toBe('"log:level":="error"');
  });

  it('keeps plain field names with letters, digits, underscores and dots unquoted', () => {
    const rule = makeRule(LogLevelRuleType.Equals, 'error', 'kubernetes.pod_name1');
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.Equals](rule)).toBe('kubernetes.pod_name1:="error"');
  });

  it('escapes quotes and backslashes in values for every operator', () => {
    const rule = makeRule(LogLevelRuleType.Equals, 'a"b\\c');
    expect(OperatorLabelsQueryBuilder[LogLevelRuleType.Equals](rule)).toBe('severity:="a\\"b\\\\c"');
  });
});

describe('LOG_LEVEL_OPTIONS', () => {
  it('offers only assignable levels — no blank `unspecified` entry', () => {
    expect(LOG_LEVEL_OPTIONS.some((opt) => opt.value === LogLevel.unspecified)).toBe(false);
    expect(LOG_LEVEL_OPTIONS.some((opt) => opt.value === LogLevel.unknown)).toBe(true);
  });
});
