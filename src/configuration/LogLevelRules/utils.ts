// utils/logLevel.ts
import { Labels, LogLevel } from '@grafana/data';

import { LogLevelRule, LogLevelRuleType } from './types';

const isValidLogLevel = (level: string): boolean => Object.keys(LogLevel).includes(level as LogLevel);

export const extractLevelFromLabels = (labels: Labels, rules: LogLevelRule[]): LogLevel => {
  const hasInfoLabel = Object.entries(labels).some(([key, value]) => {
    return key === 'level' && value !== undefined && value !== null && isValidLogLevel(value.toLowerCase());
  });

  const levelByLabel = hasInfoLabel ? labels['level'].toLowerCase() as LogLevel : null;
  const levelByRule = rules.length ? resolveLogLevel(labels, rules) : null;

  return levelByLabel || levelByRule || LogLevel.unknown;
};

const resolveLogLevel = (log: Record<string, any>, rules: LogLevelRule[]) => {
  for (const rule of rules) {
    if (rule.enabled === false) {
      continue;
    }

    const fieldValue = log[rule.field];
    const fieldValueNumber = Number(fieldValue);

    switch (rule.operator) {
      case LogLevelRuleType.Equals:
        if (fieldValue === rule.value) {
          return rule.level;
        }
        break;

      case LogLevelRuleType.NotEquals:
        if (fieldValue !== rule.value) {
          return rule.level;
        }
        break;

      case LogLevelRuleType.GreaterThan:
        if (!isNaN(fieldValueNumber) && fieldValueNumber > Number(rule.value)) {
          return rule.level;
        }
        break;

      case LogLevelRuleType.LessThan:
        if (!isNaN(fieldValueNumber) && fieldValueNumber < Number(rule.value)) {
          return rule.level;
        }
        break;

      case LogLevelRuleType.Regex:
        if (typeof fieldValue === 'string') {
          try {
            const regex = new RegExp(String(rule.value));
            if (regex.test(fieldValue)) {
              return rule.level;
            }
          } catch {
            // invalid regex — ignore
          }
        }
        break;
    }
  }

  return null;
};
