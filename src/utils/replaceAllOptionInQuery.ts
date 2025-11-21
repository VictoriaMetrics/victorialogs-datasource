import { QueryVariableModel } from "@grafana/data";

const DEFAULT_ALL_VALUE = '*';
const DEFAULT_REGEXP_ALL_VALUE = '.*';

/**
 * Replaces all occurrences of a variable in the query expression with the following priority:
 *  1. Custom All Value
 *  2. list of variables (if query defined)
 *  3. default '*' and '.*' for regex
 *
 * @param {string} queryExpr - The query expression where the variable needs to be replaced.
 * @param {QueryVariableModel} variable - The variable model containing the variable name, options, and allValue.
 * @return {string} - The modified query expression with the variable replaced by its corresponding values or patterns.
 */
export function replaceAllOptionInQuery(queryExpr: string, variable: QueryVariableModel): string {
  const variableName = variable.name;
  const allValue = normalizeAllValue(computeAllValue(variable));
  const regexpAllValue = normalizeRegexpAllValue(computeRegexpAllValue(variable));

  queryExpr = queryExpr.replaceAll(`~"$${variableName}"`, `~"${regexpAllValue}"`);
  queryExpr = queryExpr.replaceAll(`$${variableName}`, allValue);
  return queryExpr;
}

function hasModifiedAllOption(variable: QueryVariableModel): boolean {
  return Boolean(variable.query?.query || variable.allowCustomValue || variable.regex);
}

function extractOptionValues(variable: QueryVariableModel): string[] {
  return variable.options.map(option => option.value).flat(1);
}

function computeAllValue(variable: QueryVariableModel): string {
  if (variable.allValue) {
    return variable.allValue;
  }

  if (hasModifiedAllOption(variable)) {
    const values = extractOptionValues(variable);
    return values.map(value => `"${value}"`).join(',');
  }

  return DEFAULT_ALL_VALUE;
}

function computeRegexpAllValue(variable: QueryVariableModel): string {
  if (variable.allValue) {
    return variable.allValue;
  }

  if (hasModifiedAllOption(variable)) {
    const values = extractOptionValues(variable);
    return `(${values.join('|')})`;
  }

  return DEFAULT_REGEXP_ALL_VALUE;
}

// if allValue is default '.*', convert to '*' for non-regex usage
function normalizeAllValue(allValue: string): string {
  return allValue === DEFAULT_REGEXP_ALL_VALUE ? DEFAULT_ALL_VALUE : allValue;
}

// if allValue is default '*', convert to '.*' for regex usage
function normalizeRegexpAllValue(regexpAllValue: string): string {
  return regexpAllValue === DEFAULT_ALL_VALUE ? DEFAULT_REGEXP_ALL_VALUE : regexpAllValue;
}
