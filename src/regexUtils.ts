export function regularEscape(value: any) {
  if (typeof value === 'string') {
    return value.replace(/'/g, "\\\\'");
  }
  return value;
}

export function specialRegexEscape(value: any) {
  if (typeof value === 'string') {
    const escapedBackslashes = value.replace(/\\/g, '\\\\\\\\');
    const escapedSpecialChars = escapedBackslashes.replace(/[$^*{}\[\]+?.()|]/g, '\\\\$&');
    return regularEscape(escapedSpecialChars);
  }
  return value;
}
