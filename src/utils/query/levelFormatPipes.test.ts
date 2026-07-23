import { LogLevel } from '@grafana/data';

import { LogLevelRuleType } from '../../configuration/LogLevelRules/types';

import { buildLevelFormatPipes, DERIVED_LEVEL_FIELD, parseDerivedLevel } from './levelFormatPipes';

const errorRule = { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'error', level: LogLevel.error, enabled: true };
const warnRule = { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'warn', level: LogLevel.warning, enabled: true };

describe('buildLevelFormatPipes', () => {
  it('returns an empty string when there are no rules', () => {
    expect(buildLevelFormatPipes([])).toBe('');
  });

  it('starts with the unconditional reset pipe', () => {
    expect(buildLevelFormatPipes([errorRule]).startsWith(` | format "" as ${DERIVED_LEVEL_FIELD}`)).toBe(true);
  });

  it('guards every conditional pipe with an empty check on the derived field', () => {
    const pipes = buildLevelFormatPipes([errorRule, warnRule]);
    const conditional = pipes.split(' | ').filter((p) => p.startsWith('format if'));
    expect(conditional.length).toBeGreaterThan(0);
    conditional.forEach((p) => expect(p).toContain(`and ${DERIVED_LEVEL_FIELD}:""`));
  });

  it('emits level-field pipes (including unknown) before rule pipes', () => {
    const pipes = buildLevelFormatPipes([errorRule]);
    const levelPipeIdx = pipes.indexOf('level:contains_common_case');
    const rulePipeIdx = pipes.indexOf('_msg:"error"');
    expect(levelPipeIdx).toBeGreaterThan(-1);
    expect(rulePipeIdx).toBeGreaterThan(levelPipeIdx);
    expect(pipes).toContain(`"unknown" as ${DERIVED_LEVEL_FIELD}`);
  });

  it('keeps rule pipes in rule-list order (first-match-wins)', () => {
    const pipes = buildLevelFormatPipes([warnRule, errorRule]);
    expect(pipes.indexOf('_msg:"warn"')).toBeLessThan(pipes.indexOf('_msg:"error"'));
  });

  it('emits pipes for rules targeting the unknown level', () => {
    const unknownRule = { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'noise', level: LogLevel.unknown, enabled: true };
    const pipes = buildLevelFormatPipes([unknownRule]);
    expect(pipes).toContain(`if ((_msg:"noise") and ${DERIVED_LEVEL_FIELD}:"") "unknown"`);
  });

  it('escapes quotes and backslashes in rule values', () => {
    const trickyRule = { field: '_msg', operator: LogLevelRuleType.Equals, value: 'a"b\\c', level: LogLevel.error, enabled: true };
    expect(buildLevelFormatPipes([trickyRule])).toContain('_msg:"a\\"b\\\\c"');
  });

  it('skips rules with an empty field (draft rows from the rule editor)', () => {
    const draftRule = { field: '', operator: LogLevelRuleType.Equals, value: 'x', level: LogLevel.error, enabled: true };
    const pipes = buildLevelFormatPipes([draftRule, errorRule]);
    expect(pipes).not.toContain(':"x"');
    expect(pipes).toContain('_msg:"error"');
  });

  it('returns an empty string when all rules have an empty field', () => {
    const draftRule = { field: '', operator: LogLevelRuleType.Equals, value: 'x', level: LogLevel.error, enabled: true };
    expect(buildLevelFormatPipes([draftRule])).toBe('');
  });
});

describe('parseDerivedLevel', () => {
  it.each(['critical', 'error', 'warning', 'info', 'debug', 'trace', 'unknown'])(
    'maps canonical value %s to itself',
    (value) => {
      expect(parseDerivedLevel(value)).toBe(value);
    }
  );

  it('maps an empty string to unknown (no pipe matched)', () => {
    expect(parseDerivedLevel('')).toBe(LogLevel.unknown);
  });

  it('maps a foreign value to unknown', () => {
    expect(parseDerivedLevel('sev1')).toBe(LogLevel.unknown);
  });
});
