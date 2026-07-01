import { Labels, LogLevel } from '@grafana/data';

import { LogLevelRule, LogLevelRuleType } from './types';
import { extractLevelFromLabels } from './utils';

const rule = (over: Partial<LogLevelRule>): LogLevelRule => ({
  field: 'msg',
  operator: LogLevelRuleType.WordFilter,
  value: 'error',
  level: LogLevel.error,
  enabled: true,
  ...over,
});

const resolve = (labels: Labels, rules: LogLevelRule[]): LogLevel => extractLevelFromLabels(labels, rules);

describe('extractLevelFromLabels', () => {
  it('prefers a valid `level` label over rules', () => {
    const rules = [rule({ field: 'msg', value: 'error', level: LogLevel.error })];
    expect(resolve({ level: 'debug', msg: 'an error happened' }, rules)).toBe(LogLevel.debug);
  });

  it('falls back to rules when no valid `level` label exists', () => {
    const rules = [rule({ field: 'msg', value: 'error', level: LogLevel.error })];
    expect(resolve({ msg: 'an error happened' }, rules)).toBe(LogLevel.error);
  });

  it('returns `unknown` when nothing matches', () => {
    expect(resolve({ msg: 'all good' }, [])).toBe(LogLevel.unknown);
  });

  it('skips disabled rules', () => {
    const rules = [rule({ field: 'msg', value: 'error', level: LogLevel.error, enabled: false })];
    expect(resolve({ msg: 'an error happened' }, rules)).toBe(LogLevel.unknown);
  });

  it('applies the first matching rule in order', () => {
    const rules = [
      rule({ field: 'msg', value: 'warn', level: LogLevel.warning }),
      rule({ field: 'msg', value: 'error', level: LogLevel.error }),
    ];
    expect(resolve({ msg: 'a warn then error' }, rules)).toBe(LogLevel.warning);
  });
});

describe('WordFilter operator (LogsQL word filter `:`)', () => {
  const matchRule = rule({ field: 'msg', value: 'error', level: LogLevel.error });
  const apply = (msg: unknown) => resolve({ msg } as Labels, [matchRule]);

  it.each([
    ['an error happened', LogLevel.error],
    ['error: cannot open file', LogLevel.error],
    ['ERROR happened', LogLevel.unknown], // case-sensitive, mirrors LogsQL default
    ['multiple errors occurred', LogLevel.unknown], // `errors` is a different token
    ['terror detected', LogLevel.unknown], // `terror` is a different token
    ['all good', LogLevel.unknown],
  ])('value "%s" -> %s', (msg, expected) => {
    expect(apply(msg)).toBe(expected);
  });

  it('does not match when the field is missing', () => {
    expect(resolve({ other: 'error' } as Labels, [matchRule])).toBe(LogLevel.unknown);
  });

  it('empty value matches a missing field (mirrors LogsQL `field:""`)', () => {
    const rules = [rule({ field: 'msg', value: '', level: LogLevel.error })];
    expect(resolve({ other: 'x' } as Labels, rules)).toBe(LogLevel.error);
  });

  it('empty value matches an empty-string field', () => {
    const rules = [rule({ field: 'msg', value: '', level: LogLevel.error })];
    expect(resolve({ msg: '' }, rules)).toBe(LogLevel.error);
  });

  it('empty value does not match a non-empty field', () => {
    const rules = [rule({ field: 'msg', value: '', level: LogLevel.error })];
    expect(resolve({ msg: 'an error happened' }, rules)).toBe(LogLevel.unknown);
  });

  it('matches a numeric field value coerced to string', () => {
    const rules = [rule({ field: 'status', value: '500', level: LogLevel.error })];
    expect(resolve({ status: 500 } as unknown as Labels, rules)).toBe(LogLevel.error);
  });

  it('matches a multi-word phrase as a substring bounded by non-word chars', () => {
    const rules = [rule({ field: 'msg', value: 'connection refused', level: LogLevel.error })];
    expect(resolve({ msg: 'tcp connection refused by peer' }, rules)).toBe(LogLevel.error);
    expect(resolve({ msg: 'connection was refused' }, rules)).toBe(LogLevel.unknown);
  });

  it('matches a later occurrence when an earlier one is part of a longer word', () => {
    const rules = [rule({ field: 'msg', value: 'error', level: LogLevel.error })];
    expect(resolve({ msg: 'errors and an error' }, rules)).toBe(LogLevel.error);
  });

  it('does not match when the value is glued to a word char (e.g. underscore)', () => {
    const rules = [rule({ field: 'msg', value: 'error', level: LogLevel.error })];
    expect(resolve({ msg: 'error_code raised' }, rules)).toBe(LogLevel.unknown);
  });
});

describe('resolveLogLevel — existing operators (regression)', () => {
  it('Equals matches on strict equality', () => {
    const rules = [rule({ operator: LogLevelRuleType.Equals, field: 'lvl', value: 'err', level: LogLevel.error })];
    expect(resolve({ lvl: 'err' }, rules)).toBe(LogLevel.error);
    expect(resolve({ lvl: 'error' }, rules)).toBe(LogLevel.unknown);
  });

  it('NotEquals matches when the value differs', () => {
    const rules = [rule({ operator: LogLevelRuleType.NotEquals, field: 'lvl', value: 'ok', level: LogLevel.error })];
    expect(resolve({ lvl: 'bad' }, rules)).toBe(LogLevel.error);
    expect(resolve({ lvl: 'ok' }, rules)).toBe(LogLevel.unknown);
  });

  it('GreaterThan / LessThan compare numerically', () => {
    const gt = [rule({ operator: LogLevelRuleType.GreaterThan, field: 'code', value: '499', level: LogLevel.error })];
    expect(resolve({ code: '500' }, gt)).toBe(LogLevel.error);
    expect(resolve({ code: '400' }, gt)).toBe(LogLevel.unknown);

    const lt = [rule({ operator: LogLevelRuleType.LessThan, field: 'code', value: '300', level: LogLevel.info })];
    expect(resolve({ code: '200' }, lt)).toBe(LogLevel.info);
    expect(resolve({ code: 'not-a-number' }, lt)).toBe(LogLevel.unknown);
  });

  it('Regex matches and ignores invalid patterns', () => {
    const ok = [rule({ operator: LogLevelRuleType.Regex, field: 'msg', value: '^err', level: LogLevel.error })];
    expect(resolve({ msg: 'error here' }, ok)).toBe(LogLevel.error);

    const broken = [rule({ operator: LogLevelRuleType.Regex, field: 'msg', value: '(', level: LogLevel.error })];
    expect(resolve({ msg: 'error here' }, broken)).toBe(LogLevel.unknown);
  });

  it('CaseInsensitiveEquals matches regardless of case', () => {
    const rules = [
      rule({ operator: LogLevelRuleType.CaseInsensitiveEquals, field: 'lvl', value: 'error', level: LogLevel.error }),
    ];
    expect(resolve({ lvl: 'ERROR' }, rules)).toBe(LogLevel.error);
    expect(resolve({ lvl: 'warn' }, rules)).toBe(LogLevel.unknown);
  });
});
