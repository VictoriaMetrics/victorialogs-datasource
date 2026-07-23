import { FieldType, LogLevel, toDataFrame } from '@grafana/data';

import { LogLevelRuleType } from './configuration/LogLevelRules/types';
import { extractLevel } from './logsVolumeLegacy';
import { DERIVED_LEVEL_FIELD } from './utils/query/levelFormatPipes';

const makeFrame = (labels?: Record<string, string>) =>
  toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      { name: 'Value', type: FieldType.number, values: [1], labels },
    ],
  });

describe('extractLevel', () => {
  it('maps the derived level label directly', () => {
    expect(extractLevel(makeFrame({ [DERIVED_LEVEL_FIELD]: 'error' }), [])).toBe(LogLevel.error);
  });

  it('maps an empty derived level to unknown without applying rules', () => {
    const rules = [
      { field: '_msg', operator: LogLevelRuleType.WordFilter, value: 'error', level: LogLevel.error, enabled: true },
    ];
    expect(extractLevel(makeFrame({ [DERIVED_LEVEL_FIELD]: '' }), rules)).toBe(LogLevel.unknown);
  });

  it('falls back to label matching when the derived label is absent', () => {
    expect(extractLevel(makeFrame({ level: 'error' }), [])).toBe(LogLevel.error);
  });

  it('returns unknown when the value field has no labels', () => {
    expect(extractLevel(makeFrame(), [])).toBe(LogLevel.unknown);
  });
});
