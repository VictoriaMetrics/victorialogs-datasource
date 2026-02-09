const varTypeFunc = [
  (v: string) => `\$${v}`,
  (v: string, f?: string) => `[[${v}${f ? `:${f}` : ''}]]`,
  (v: string, f?: string) => `\$\{${v}${f ? `:${f}` : ''}\}`,
];

export const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?]]|\${(\w+)(?:\.([^:^}]+))?(?::([^}]+))?}/g;

export function returnVariables(expr: string) {
  const replacer = (match: string, type: any, v: any, f: any) => varTypeFunc[parseInt(type, 10)](v, f);
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

/*
*  ' ' - for filter separator
*  '|' - for pipe separator
*  '}' - for end of a stream
*  ',' - for stream filter separator
* */
const validAfterVariableChars = [' ', '|', '}', ','];
function findIndexEndOfFilter(expr: string, startIndex = 0): number {
  for (let i = startIndex; i < expr.length; i++) {
    if (validAfterVariableChars.includes(expr[i])) {
      return i;
    }
  }
  return -1;
}

enum OperatorType {
  NEGATED_EQUALS = 'NEGATED_EQUALS',    // :! or :!= or !=
  EQUALS = 'EQUALS',                    // : or := or =
  NONE = 'NONE'
}

interface OperatorInfo {
  startOperatorIndex: number;
  type: OperatorType;
  length: number;
  leftSpaces: number;
  rightSpaces: number;
  isStreamOperator?: boolean;
}

function isValidVariablePosition(char: string | undefined): boolean {
  return !char || validAfterVariableChars.includes(char);
}

function shouldSkipVariable(result: string, varIndex: number, varPattern: string): boolean {
  if (varIndex === 0) {
    return true;
  }

  const charAfterVar = result[varIndex + varPattern.length];
  return !isValidVariablePosition(charAfterVar);
}

function countLeftSpaces(str: string, endPos: number): number {
  let count = 0;
  for (let i = endPos - 1; i >= 0 && str[i] === ' '; i--) {
    count++;
  }
  return count;
}

function detectStreamOperator(queryExpr: string, endOperatorPos: number, rightSpaces: number): null | OperatorInfo {
  if (queryExpr[endOperatorPos - 1] !== '=') {
    return null;
  }

  if (queryExpr[endOperatorPos - 2] === '!' && queryExpr[endOperatorPos - 3] !== ':') {
    const startOperatorIndex = endOperatorPos - 2;
    const leftSpaces = countLeftSpaces(queryExpr, startOperatorIndex);
    return {
      type: OperatorType.NEGATED_EQUALS,
      length: 2,
      leftSpaces,
      rightSpaces,
      startOperatorIndex,
      isStreamOperator: true
    };
  }

  const invalidPreChars = [':', '!'];
  if (!invalidPreChars.includes(queryExpr[endOperatorPos - 2])) {
    const startOperatorIndex = endOperatorPos - 1;
    const leftSpaces = countLeftSpaces(queryExpr, startOperatorIndex);
    return {
      type: OperatorType.EQUALS,
      length: 1,
      leftSpaces,
      rightSpaces,
      startOperatorIndex,
      isStreamOperator: true
    };
  }

  return null;
}

/**
 * Detects the operator in the given query expression near a specified variable index.
 *
 * @param {string} queryExpr - The query expression string to analyze.
 * @param {number} varIndex - The index of the variable or reference point in the query expression to check for an operator.
 * @return {OperatorInfo} An object representing details about the detected operator, including its type, length, spaces around it, and its starting index.
 */
function detectOperator(queryExpr: string, varIndex: number): OperatorInfo {
  const rightSpaces = countLeftSpaces(queryExpr, varIndex);
  const endOperatorPos = varIndex - rightSpaces;

  // for operator "!=" | "="
  const streamOperator = detectStreamOperator(queryExpr, endOperatorPos, rightSpaces);
  if (streamOperator) {
    return streamOperator;
  }

  // for operator ":"
  let startOperatorIndex = endOperatorPos - 1;
  let length = 1;
  let leftSpaces = countLeftSpaces(queryExpr, startOperatorIndex);
  const oneCharBeforeSpaces = queryExpr[endOperatorPos - 1];
  if (oneCharBeforeSpaces === ':' ) {
    return { type: OperatorType.EQUALS, length, leftSpaces, rightSpaces, startOperatorIndex };
  }

  // for operator ":=" | ":!"
  startOperatorIndex = endOperatorPos - 2;
  length = 2;
  leftSpaces = countLeftSpaces(queryExpr, startOperatorIndex);
  const twoCharsBeforeSpaces = queryExpr.slice(Math.max(0, startOperatorIndex), endOperatorPos);
  const twoCharsOperators = [':=', ':!'];
  if (twoCharsOperators.includes(twoCharsBeforeSpaces)) {
    const type = twoCharsBeforeSpaces.includes('!') ? OperatorType.NEGATED_EQUALS : OperatorType.EQUALS;
    return { type, length, leftSpaces, rightSpaces, startOperatorIndex };
  }

  // for operator ":!="
  startOperatorIndex = endOperatorPos - 3;
  length = 3;
  leftSpaces = countLeftSpaces(queryExpr, startOperatorIndex);
  const threeCharsBeforeSpaces = queryExpr.slice(Math.max(0, startOperatorIndex), endOperatorPos);
  const threeCharsOperators = [':!='];
  if (threeCharsOperators.includes(threeCharsBeforeSpaces)) {
    return { type: OperatorType.NEGATED_EQUALS, length, leftSpaces, rightSpaces, startOperatorIndex };
  }

  return { type: OperatorType.NONE, length: 0, leftSpaces: 0, rightSpaces: 0, startOperatorIndex: -1 };
}

function findFieldName(result: string, operatorStart: number): { fieldName: string; fieldStart: number } {
  let fieldStart = operatorStart - 1;
  while (fieldStart >= 0 && result[fieldStart] !== ' ' && result[fieldStart] !== '|') {
    fieldStart--;
  }
  fieldStart++;

  const fieldName = result.slice(fieldStart, operatorStart);
  return { fieldName, fieldStart };
}

function transformNegatedOperator(
  result: string,
  varIndex: number,
  varPattern: string,
  operatorInfo: OperatorInfo,
  actualEndIndex: number
): { transformed: string; newSearchStart: number } {
  const totalSpaces = operatorInfo.leftSpaces + operatorInfo.rightSpaces;
  const operatorStart = varIndex - operatorInfo.length - totalSpaces;
  const afterVariable = result.slice(actualEndIndex);

  const { fieldName, fieldStart } = findFieldName(result, operatorStart);
  const beforeField = result.slice(0, fieldStart);

  let filterPart: string;
  if(operatorInfo.isStreamOperator){
    filterPart = `${fieldName.trimEnd()} not_in(${varPattern})`;
  } else {
    filterPart = `!${fieldName.trimEnd()}:in(${varPattern})`;
  }

  const transformed = `${beforeField}${filterPart}${afterVariable}`;
  const newSearchStart = beforeField.length + filterPart.length;

  return { transformed, newSearchStart };
}

function transformWithOperator(
  result: string,
  varIndex: number,
  varPattern: string,
  operatorInfo: OperatorInfo,
  actualEndIndex: number
): { transformed: string; newSearchStart: number } {
  const totalSpaces = operatorInfo.leftSpaces + operatorInfo.rightSpaces;
  const operatorStart = varIndex - operatorInfo.length - totalSpaces;
  const beforeOperator = result.slice(0, operatorStart);
  const afterVariable = result.slice(actualEndIndex);
  const inOperator = operatorInfo.isStreamOperator ? ' in' : ':in';

  const filterWithBeforeOperatorPart = `${beforeOperator.trimEnd()}${inOperator}(${varPattern})`;
  const transformed = filterWithBeforeOperatorPart + afterVariable;

  return { transformed, newSearchStart: filterWithBeforeOperatorPart.length };
}

/**
 * Replaces occurrences of a specific variable `variableName` within the operator 'in' in a given expression.
 *
 * @param {string} expr - The expression in which variable patterns and operators need to be replaced or transformed.
 * @param {string} variableName - The name of the variable to look for in the expression, prefixed with a `$` symbol.
 * @return {string} - The transformed expression with the specified variable patterns replaced according to the defined rules.
 */
export function replaceOperatorWithIn(expr: string, variableName: string): string {
  const varPattern = `$${variableName}`;
  let result = expr;
  let searchStart = 0;

  while (true) {
    const varIndex = result.indexOf(varPattern, searchStart);

    if (varIndex === -1) {
      break;
    }

    if (shouldSkipVariable(result, varIndex, varPattern)) {
      searchStart = varIndex + varPattern.length;
      continue;
    }

    const filterEndIndex = findIndexEndOfFilter(result, varIndex + varPattern.length);
    const actualEndIndex = filterEndIndex === -1 ? result.length : filterEndIndex;

    const operatorInfo = detectOperator(result, varIndex);

    if (operatorInfo.type === OperatorType.NEGATED_EQUALS) {
      const { transformed, newSearchStart } = transformNegatedOperator(
        result,
        varIndex,
        varPattern,
        operatorInfo,
        actualEndIndex
      );
      result = transformed;
      searchStart = newSearchStart;
    } else if (operatorInfo.type === OperatorType.EQUALS) {
      const { transformed, newSearchStart } = transformWithOperator(
        result,
        varIndex,
        varPattern,
        operatorInfo,
        actualEndIndex
      );
      result = transformed;
      searchStart = newSearchStart;
    } else {
      searchStart = varIndex + varPattern.length;
    }
  }

  return result;
}
