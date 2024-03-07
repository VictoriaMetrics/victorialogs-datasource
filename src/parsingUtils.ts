const varTypeFunc = [
  (v: string) => `\$${v}`,
  (v: string, f?: string) => `[[${v}${f ? `:${f}` : ''}]]`,
  (v: string, f?: string) => `\$\{${v}${f ? `:${f}` : ''}\}`,
];

export const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?]]|\${(\w+)(?:\.([^:^}]+))?(?::([^}]+))?}/g;

export function returnVariables(expr: string) {
  const replacer = (match: string, type: any, v: any, f: any) => varTypeFunc[parseInt(type, 10)](v, f)
  return expr.replace(/__V_(\d)__(.+?)__V__(?:__F__(\w+)__F__)?/g, replacer);
}


export function replaceVariables(expr: string) {
  return expr.replace(variableRegex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
    const fmt = fmt2 || fmt3;
    let variable = var1;
    let varType = '0';

    if (var2) {
      variable = var2;
      varType = '1';
    }

    if (var3) {
      variable = var3;
      varType = '2';
    }

    return `__V_${varType}__` + variable + '__V__' + (fmt ? '__F__' + fmt + '__F__' : '');
  });
}
