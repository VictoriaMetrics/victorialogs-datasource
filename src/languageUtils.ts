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

function isLogLineJSON(msg: string): boolean {
  try {
    const parsed = JSON.parse(msg);
    return typeof parsed === 'object' && parsed !== null;
  } catch (e) {
    return false;
  }
}
const LOGFMT_REGEXP = /(?:^|\s)([\w\(\)\[\]\{\}]+)=(""|(?:".*?[^\\]"|[^"\s]\S*))/;

function isLogLineLogfmt(msg: string): boolean {
  return LOGFMT_REGEXP.test(msg);
}

export function extractLogParserFromSample(sample: Record<string, unknown>[]): {
  hasLogfmt: boolean;
  hasJSON: boolean;
} {
  if (sample.length === 0) {
    return { hasJSON: false, hasLogfmt: false };
  }

  let hasJSON = false;
  let hasLogfmt = false;

  sample.forEach((line) => {
    const msg: string = line['_msg'] as string;
    if (isLogLineJSON(msg)) {
      hasJSON = true;
    }
    if (isLogLineLogfmt(msg)) {
      hasLogfmt = true;
    }
  });

  return { hasLogfmt, hasJSON };
}
