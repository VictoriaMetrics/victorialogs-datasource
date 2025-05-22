// utils/logLevel.ts
import { LogLevel } from '@grafana/data';

import { LogLevelRule, LogLevelRuleType } from "./types";

export const resolveLogLevel = (log: Record<string, any>, rules: LogLevelRule[]): LogLevel => {
  for (const rule of rules) {
    if (!rule.enabled) {
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

      case LogLevelRuleType.Includes:
        if (typeof fieldValue === 'string' && String(fieldValue).includes(String(rule.value))) {
          return rule.level;
        }
        break;
    }
  }

  return LogLevel.unknown;
}
