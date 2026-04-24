import { LogLevel } from '@grafana/data';

import { DerivedFieldConfig } from '../../types';
import { LogLevelRule, LogLevelRuleType } from '../LogLevelRules/types';

import { OTEL_LEVEL_TO_SEVERITY_NUMBER } from './constants';
import { OpenTelemetryPreset, OpenTelemetryPresetSeverity } from './types';

export function buildPresetDerivedFields(preset: OpenTelemetryPreset): DerivedFieldConfig[] {
  const { detection, tracesDatasourceUid } = preset;
  if (!detection) {
    return [];
  }
  const uid = tracesDatasourceUid ?? '';
  return [
    {
      datasourceUid: uid,
      name: detection.traceIdField,
      matcherType: 'label',
      matcherRegex: detection.traceIdField,
      url: '${__value.raw}',
      urlDisplayLabel: 'View trace',
    },
  ];
}

export function buildLogLevelRulesBySeverity(severity: OpenTelemetryPresetSeverity): LogLevelRule[] {
  const rules: LogLevelRule[] = [];
  const emit = (value: string, level: LogLevel, operator: LogLevelRuleType) => {
    rules.push({
      field: severity.field,
      operator,
      value,
      level,
      enabled: true,
    });
  };

  switch (severity.valueCase) {
    case 'string': {
      Object.entries(LogLevel).forEach(([value, level]) => {
        emit(`${value}`, level, LogLevelRuleType.CaseInsensitiveEquals);
      });
      break;
    }
    case 'number': {
      Object.entries(OTEL_LEVEL_TO_SEVERITY_NUMBER).forEach(([level, value]) => {
        emit(value, level as LogLevel, LogLevelRuleType.Regex);
      });
      break;
    }
  }

  return rules;
}

export function buildPresetLogLevelRules(preset: OpenTelemetryPreset): LogLevelRule[] {
  const severity = preset.detection?.severity;
  if (!severity) {
    return [];
  }

  return buildLogLevelRulesBySeverity(severity);
}

export function mergePresetDerivedFields(
  userFields: DerivedFieldConfig[],
  presetFields: DerivedFieldConfig[],
): DerivedFieldConfig[] {
  const userNames = new Set(userFields.map(f => f.name));
  return [...userFields, ...presetFields.filter(f => !userNames.has(f.name))];
}

export function mergePresetLogLevelRules(
  userRules: LogLevelRule[],
  presetRules: LogLevelRule[],
): LogLevelRule[] {
  const keyOf = (r: LogLevelRule) => `${r.field}|${r.operator}|${r.value}`;
  const userKeys = new Set(userRules.map(keyOf));
  return [...userRules, ...presetRules.filter(r => !userKeys.has(keyOf(r)))];
}
