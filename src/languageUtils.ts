const REG_METACHARACTERS = /[*+?()|\\.\[\]{}^$]/g;

export function unescapeLabelValue(labelValue: string): string {
  return labelValue.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function isRegexSelector(selector?: string) {
  return !!(selector && (selector.includes('=~') || selector.includes('!~')));
}

function escapeMetaRegexp(value: string): string {
  return value.replace(REG_METACHARACTERS, '\\$&');
}

export function escapeLabelValueInExactSelector(labelValue: string): string {
  return labelValue.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

export function escapeLabelValueInRegexSelector(labelValue: string): string {
  return escapeLabelValueInExactSelector(escapeMetaRegexp(labelValue));
}

export function escapeLabelValueInSelector(labelValue: string, selector?: string): string {
  return isRegexSelector(selector)
    ? escapeLabelValueInRegexSelector(labelValue)
    : escapeLabelValueInExactSelector(labelValue);
}
