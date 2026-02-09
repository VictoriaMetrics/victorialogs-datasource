export function handleQuotes(string: string) {
  if (string[0] === "\"" && string[string.length - 1] === "\"") {
    return string
      .substring(1, string.length - 1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return string.replace(/`/g, "");
}

// remove double quotes around the variable name if it's not a regex selector `~`
export function removeDoubleQuotesAroundVar(queryExpr: string, variableName: string): string {
  const regex = new RegExp(`(?<!~)"\\$${variableName}"`, "g");
  queryExpr = queryExpr.replace(regex, `$${variableName}`);
  return queryExpr;
}
