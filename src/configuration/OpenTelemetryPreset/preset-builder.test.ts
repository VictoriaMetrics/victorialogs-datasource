import { LogLevel } from '@grafana/data';

import { DerivedFieldConfig } from '../../types';
import { LogLevelRule, LogLevelRuleType } from '../LogLevelRules/types';

import {
  buildPresetDerivedFields,
  buildPresetLogLevelRules,
  mergePresetDerivedFields,
  mergePresetLogLevelRules,
} from './preset-builder';
import { OpenTelemetryPreset } from './types';

const presetSnake: OpenTelemetryPreset = {
  enabled: true,
  tracesDatasourceUid: 'tempo-uid',
  detection: {
    traceIdField: 'trace_id',
  },
};

const presetCamel: OpenTelemetryPreset = {
  enabled: true,
  tracesDatasourceUid: 'tempo-uid',
  detection: {
    traceIdField: 'traceId',
  },
};

describe('buildPresetDerivedFields', () => {
  it('returns one field (trace only) for snake_case', () => {
    const out = buildPresetDerivedFields(presetSnake);
    expect(out.map(f => f.name)).toEqual(['trace_id']);
  });

  it('returns one field (trace only) for camelCase', () => {
    const out = buildPresetDerivedFields(presetCamel);
    expect(out.map(f => f.name)).toEqual(['traceId']);
  });

  it('uses matcherType label for all preset fields', () => {
    const out = buildPresetDerivedFields(presetSnake);
    expect(out.every(f => f.matcherType === 'label')).toBe(true);
  });

  it('sets matcherRegex to the field name for snake_case', () => {
    const [traceField] = buildPresetDerivedFields(presetSnake);
    expect(traceField.matcherRegex).toBe('trace_id');
  });

  it('sets matcherRegex to the field name for camelCase', () => {
    const [traceField] = buildPresetDerivedFields(presetCamel);
    expect(traceField.matcherRegex).toBe('traceId');
  });

  it('propagates tracesDatasourceUid to the preset field', () => {
    const out = buildPresetDerivedFields(presetSnake);
    expect(out.every(f => f.datasourceUid === 'tempo-uid')).toBe(true);
  });

  it('falls back to empty datasourceUid when tracesDatasourceUid is undefined', () => {
    const out = buildPresetDerivedFields({ ...presetSnake, tracesDatasourceUid: undefined });
    expect(out.every(f => f.datasourceUid === '')).toBe(true);
  });

  it('returns empty list when detection is missing', () => {
    expect(buildPresetDerivedFields({ enabled: true })).toEqual([]);
  });
});

function withSeverity(
  base: OpenTelemetryPreset,
  valueCase: 'string' | 'number',
): OpenTelemetryPreset {
  return {
    ...base,
    detection: {
      ...base.detection!,
      severity: {
        field: 'severity_text',
        valueCase,
        source: 'auto',
      },
    },
  };
}

describe('buildPresetLogLevelRules', () => {
  it('generates CaseInsensitiveEquals rules for all LogLevel entries in string case', () => {
    const out = buildPresetLogLevelRules(withSeverity(presetSnake, 'string'));
    expect(out.length).toBeGreaterThan(0);
    expect(out.every(r => r.operator === LogLevelRuleType.CaseInsensitiveEquals)).toBe(true);
    expect(out.every(r => r.field === 'severity_text')).toBe(true);
  });

  it('generates 6 Regex rules for number case', () => {
    const out = buildPresetLogLevelRules(withSeverity(presetSnake, 'number'));
    expect(out).toHaveLength(6);
    expect(out.every(r => r.operator === LogLevelRuleType.Regex)).toBe(true);
    expect(out.every(r => r.field === 'severity_text')).toBe(true);
  });

  it('maps warn → warning and critical → critical in string case', () => {
    const out = buildPresetLogLevelRules(withSeverity(presetSnake, 'string'));
    const warnRule = out.find(r => r.value === 'warn')!;
    const criticalRule = out.find(r => r.value === 'critical')!;
    expect(warnRule.level).toBe(LogLevel.warning);
    expect(criticalRule.level).toBe(LogLevel.critical);
  });

  it('sets enabled: true on all preset rules', () => {
    const out = buildPresetLogLevelRules(withSeverity(presetSnake, 'string'));
    expect(out.every(r => r.enabled === true)).toBe(true);
  });

  it('returns empty list when detection is missing', () => {
    expect(buildPresetLogLevelRules({ enabled: true })).toEqual([]);
  });

  it('returns empty list when severity is missing from detection', () => {
    expect(buildPresetLogLevelRules(presetSnake)).toEqual([]);
  });
});

describe('mergePresetDerivedFields', () => {
  const userField: DerivedFieldConfig = {
    name: 'trace_id',
    matcherRegex: 'user-regex',
    matcherType: 'regex',
    datasourceUid: 'user-uid',
    url: '',
  };
  const presetTraceField: DerivedFieldConfig = {
    name: 'trace_id',
    matcherRegex: 'preset-regex',
    matcherType: 'regex',
    datasourceUid: 'preset-uid',
    url: '',
  };
  const presetSpanField: DerivedFieldConfig = {
    name: 'span_id',
    matcherRegex: 'preset-regex',
    matcherType: 'regex',
    datasourceUid: 'preset-uid',
    url: '',
  };

  it('keeps user entry and drops preset entry on name collision', () => {
    const out = mergePresetDerivedFields([userField], [presetTraceField, presetSpanField]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(userField);
    expect(out[1]).toBe(presetSpanField);
  });

  it('appends all preset entries when no user overlap', () => {
    const out = mergePresetDerivedFields([], [presetTraceField, presetSpanField]);
    expect(out).toEqual([presetTraceField, presetSpanField]);
  });

  it('returns user list unchanged when preset list is empty', () => {
    const out = mergePresetDerivedFields([userField], []);
    expect(out).toEqual([userField]);
  });
});

describe('mergePresetLogLevelRules', () => {
  const userRule: LogLevelRule = {
    field: 'severity_text',
    operator: LogLevelRuleType.Equals,
    value: 'ERROR',
    level: LogLevel.critical,
    enabled: true,
  };
  const presetErrorRule: LogLevelRule = {
    field: 'severity_text',
    operator: LogLevelRuleType.Equals,
    value: 'ERROR',
    level: LogLevel.error,
    enabled: true,
  };
  const presetWarnRule: LogLevelRule = {
    field: 'severity_text',
    operator: LogLevelRuleType.Equals,
    value: 'WARN',
    level: LogLevel.warning,
    enabled: true,
  };

  it('keeps user rule and drops preset rule on field|operator|value match', () => {
    const out = mergePresetLogLevelRules([userRule], [presetErrorRule, presetWarnRule]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(userRule);
    expect(out[1]).toBe(presetWarnRule);
  });

  it('does not dedupe on level alone (only field|operator|value)', () => {
    const out = mergePresetLogLevelRules([userRule], [presetErrorRule]);
    expect(out).toEqual([userRule]);
  });

  it('appends all preset rules when no user overlap', () => {
    const out = mergePresetLogLevelRules([], [presetErrorRule, presetWarnRule]);
    expect(out).toEqual([presetErrorRule, presetWarnRule]);
  });
});
