import { LogLevel } from "@grafana/data";

export interface LogLevelRule {
  field: string;
  operator: LogLevelRuleType;
  value: string | number | boolean;
  level: LogLevel;
  enabled: boolean;
  description?: string;
}

export enum LogLevelRuleType {
  Equals = 'equals',
  NotEquals = 'notEquals',
  GreaterThan = 'greaterThan',
  LessThan = 'lessThan',
  Regex = 'regex',
  Includes = 'includes',
}
