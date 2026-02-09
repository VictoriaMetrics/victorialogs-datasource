import { LogLevel } from '@grafana/data';
import { colors, ComboboxOption } from '@grafana/ui';

import { LogLevelRuleType } from './types';

export interface LogOperatorOption {
  value: LogLevelRuleType;
  label: string;
  description: string;
}

export const LOG_OPERATOR_OPTIONS: LogOperatorOption[] = [
  { label: '=', description: 'Equals', value: LogLevelRuleType.Equals },
  { label: '!=', description: 'Not equal', value: LogLevelRuleType.NotEquals },
  { label: '=~', description: 'Matches regex', value: LogLevelRuleType.Regex },
  { label: '<', description: 'Less than', value: LogLevelRuleType.LessThan },
  { label: '>', description: 'Greater than', value: LogLevelRuleType.GreaterThan },
];

export const OperatorLabels: Record<LogLevelRuleType, string> = {
  [LogLevelRuleType.Equals]: '=',
  [LogLevelRuleType.NotEquals]: '!=',
  [LogLevelRuleType.Regex]: '~',
  [LogLevelRuleType.LessThan]: '<',
  [LogLevelRuleType.GreaterThan]: '>',
};

export const LOG_LEVEL_OPTIONS: Array<ComboboxOption<LogLevel>> = Array.from(
  new Set(Object.values(LogLevel))
).map((level) => ({
  label: level,
  value: level as LogLevel,
}));

export const UNIQ_LOG_LEVEL = {
  [LogLevel.critical]: LogLevel.critical,
  [LogLevel.error]: LogLevel.error,
  [LogLevel.warning]: LogLevel.warning,
  [LogLevel.info]: LogLevel.info,
  [LogLevel.debug]: LogLevel.debug,
  [LogLevel.trace]: LogLevel.trace,
  [LogLevel.unknown]: LogLevel.unknown,
} as const;

export type UniqLogLevelKeys = (typeof UNIQ_LOG_LEVEL)[keyof typeof UNIQ_LOG_LEVEL];

export const possibleLogValueByLevelType = Object.keys(LogLevel).reduce((acc, possibleValue) => {
  const levelName = LogLevel[possibleValue as LogLevel];
  if (!acc[levelName]) {
    acc[levelName] = [];
  }

  acc[levelName].push(possibleValue as string);
  return acc;
}, {} as Record<UniqLogLevelKeys, string[]>);

export const LOG_LEVEL_COLOR = {
  [LogLevel.critical]: colors[7],
  [LogLevel.error]: colors[4],
  [LogLevel.warning]: colors[1],
  [LogLevel.info]: colors[0],
  [LogLevel.debug]: colors[5],
  [LogLevel.trace]: colors[2],
  [LogLevel.unknown]: '#8e8e8e',
};
