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

const resolveLogLevel = (log: Labels, rules: LogLevelRule[]): LogLevel | null => {
  for (const rule of rules) {
    if (rule.enabled === false) {
      continue;
    }

    if (ruleMatchers[rule.operator]?.(log[rule.field], rule)) {
      return rule.level;
    }
  }

  return null;
};

type RuleMatcher = (fieldValue: unknown, rule: LogLevelRule) => boolean;

const ruleMatchers: Record<LogLevelRuleType, RuleMatcher> = {
  [LogLevelRuleType.Equals]: (fieldValue, rule) => fieldValue === rule.value,
  [LogLevelRuleType.NotEquals]: (fieldValue, rule) => fieldValue !== rule.value,
  [LogLevelRuleType.GreaterThan]: (fieldValue, rule) => compareNumeric(fieldValue, rule.value, (a, b) => a > b),
  [LogLevelRuleType.LessThan]: (fieldValue, rule) => compareNumeric(fieldValue, rule.value, (a, b) => a < b),
  [LogLevelRuleType.Regex]: (fieldValue, rule) => matchesRegex(fieldValue, rule.value),
  [LogLevelRuleType.CaseInsensitiveEquals]: (fieldValue, rule) =>
    typeof fieldValue === 'string' && fieldValue.toLowerCase() === rule.value,
  [LogLevelRuleType.WordFilter]: (fieldValue, rule) => matchesWordFilter(fieldValue, rule.value),
};

const compareNumeric = (
  fieldValue: unknown,
  ruleValue: string | number,
  compare: (a: number, b: number) => boolean
): boolean => {
  const a = Number(fieldValue);
  const b = Number(ruleValue);
  return !isNaN(a) && !isNaN(b) && compare(a, b);
};

const matchesRegex = (fieldValue: unknown, ruleValue: string | number): boolean => {
  if (typeof fieldValue !== 'string') {
    return false;
  }

  try {
    return new RegExp(String(ruleValue)).test(fieldValue);
  } catch {
    // invalid regex — ignore
    return false;
  }
};

// A char belongs to a word if it is a unicode letter, digit or underscore
const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;
const isWordChar = (char: string | undefined): boolean => char !== undefined && WORD_CHAR_RE.test(char);

const matchesWordFilter = (fieldValueRaw: unknown, ruleValueRaw: string | number): boolean => {
  const ruleValue = String(ruleValueRaw ?? '');

  // An empty word filter mirrors LogsQL `field:""`: it matches an empty or missing field
  // (LogsQL treats empty values as non-existing).
  if (ruleValue === '') {
    return fieldValueRaw === undefined || fieldValueRaw === null || String(fieldValueRaw) === '';
  }

  if (fieldValueRaw === undefined || fieldValueRaw === null) {
    return false;
  }

  const fieldValue = String(fieldValueRaw);

  for (let at = fieldValue.indexOf(ruleValue); at !== -1; at = fieldValue.indexOf(ruleValue, at + 1)) {
    const charBefore = fieldValue[at - 1];
    const charAfter = fieldValue[at + ruleValue.length];
    if (!isWordChar(charBefore) && !isWordChar(charAfter)) {
      return true;
    }
  }

  return false;
};
