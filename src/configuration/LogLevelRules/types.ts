import { LogLevel } from "@grafana/data";

export interface LogLevelRule {
  field: string;
  operator: LogLevelRuleType;
  value: string | number;
  level: LogLevel;
  enabled?: boolean;
}

export enum LogLevelRuleType {
  Equals = "equals",
  NotEquals = "notEquals",
  GreaterThan = "greaterThan",
  LessThan = "lessThan",
  Regex = "regex",
}
