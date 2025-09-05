interface SplitStringBracket {
  type: "bracket";
  value: SplitString[];
  raw_value: string;
  prefix: string;
}

interface SplitStringValue {
  type: "quote" | "space" | "colon";
  value: string;
}

interface SplitStringComment {
  type: "comment";
  value: string;
}

export type SplitString = SplitStringValue | SplitStringBracket | SplitStringComment;

export const splitString = (str: string): SplitString[] => {
  str = str.trim();
  const result: SplitString[] = [];
  if (str === "") {
    return result;
  }
  let isEscaped = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let currentPart = '';
  let openingBrackets = ["(", "[", "{"];
  let closingBrackets = [")", "]", "}"];
  let bracketCount = 0;
  let bracketPrefix = "";
  let isComment = false;
  const singleChars = [",", "|", "=", " ", "\n", "\r", "!"];
  for (let char of str) {
    if (bracketCount > 0) {
      currentPart += char;
      if (closingBrackets.includes(char)) {
        bracketCount--;
        if (bracketCount === 0) {
          if (!closingBrackets.includes(currentPart.charAt(0))) { // check for prefix
            for (const char of currentPart) {
              if (openingBrackets.includes(currentPart.charAt(0))) {
                break;
              }
              bracketPrefix += char;
              currentPart = currentPart.slice(1);
            }
          }
          result.push({ type: "bracket", raw_value: currentPart, prefix: bracketPrefix, value: splitString(currentPart.slice(1, -1)) });
          bracketPrefix = '';
          currentPart = '';
        }
      } else if (openingBrackets.includes(char)) {
        bracketCount++;
      }
    } else if (isEscaped) {
      currentPart += char;
      isEscaped = false;
    } else if (isComment) {
      if (char === "\n") {
        isComment = false;
        if (currentPart.trim() !== '') {
          result.push({ type: "comment", value: currentPart.trim() });
        }
        currentPart = '';
      } else {
        currentPart += char;
      }
    } else if (char === "`" && !inSingleQuote && !inDoubleQuote) {
      isEscaped = false;
      inBacktick = !inBacktick;
      if (inSingleQuote && currentPart.trim() !== '') {
        result.push({ type: "quote", value: currentPart.trim() });
        currentPart = '';
      }
      currentPart += char;
      if (!inBacktick) {
        result.push({ type: "quote", value: currentPart });
        currentPart = '';
      }
    } else if (inBacktick) {
      currentPart += char;
    } else if (char === '\\') {
      currentPart += char;
      isEscaped = true;
    } else if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
      if (inSingleQuote && currentPart.trim() !== '') {
        result.push({ type: "space", value: currentPart.trim() });
        currentPart = '';
      }
      currentPart += char;
      if (!inSingleQuote) {
        result.push({ type: "quote", value: currentPart });
        currentPart = '';
      }
    } else if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
      if (inDoubleQuote && currentPart.trim() !== '') {
        result.push({ type: "space", value: currentPart.trim() });
        currentPart = '';
      }
      currentPart += char;
      if (!inDoubleQuote) {
        result.push({ type: "quote", value: currentPart });
        currentPart = '';
      }
    } else if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (char === "#") {
        isComment = true;
      } else if (char === ":") {
        result.push({ type: "colon", value: currentPart });
        currentPart = '';
      } else if (openingBrackets.includes(char)) {
        bracketCount = 1;
        currentPart += char;
      } else if (char === "-" && currentPart.trim() === "") { // Not operator
        result.push({ type: "space", value: "-" });
        currentPart = "";
      } else if (singleChars.includes(char)) {
        if (currentPart.trim()) {
          result.push({ type: "space", value: currentPart.trim() });
        }
        currentPart = "";
        if (char.trim() !== "") {
          result.push({ type: "space", value: char });
        }
      } else {
        currentPart += char;
      }
    } else {
      currentPart += char;
    }
  }
  if (currentPart.trim() !== "") {
    if (inDoubleQuote || inSingleQuote || inBacktick) {
      result.push({ type: "quote", value: currentPart + currentPart.slice(0, 1) });
    } else if (bracketCount > 0) {
      result.push({ type: "bracket", raw_value: currentPart, prefix: bracketPrefix, value: splitString(currentPart.slice(1, 0)) });
    } else if (isComment) {
      result.push({ type: "comment", value: currentPart.trim() });
    } else {
      result.push({ type: "space", value: currentPart.trim() });
    }
  }
  return result;
}

export const buildSplitString = (str: SplitString[]): string => {
  let result = '';
  for (const part of str) {
    if (part.type === "bracket") {
      result += part.prefix + part.raw_value;
    } else if (part.type === "quote" || part.type === "space") {
      result += part.value;
    } else {
      result += part.value + ":";
    }
    result += " ";
  }
  return result.trim();
}

export const splitByUnescapedChar = (str: SplitString[], checkChar: string): SplitString[][] => {
  let lastI = 0;
  let result: SplitString[][] = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i].value;
    if (char === checkChar) {
      result.push(str.slice(lastI, i));
      lastI = i + 1;
    }
  }
  if (lastI < str.length) {
    result.push(str.slice(lastI));
  }
  return result;
}

export const splitByUnescapedPipe = (str: SplitString[]): SplitString[][] => {
  return splitByUnescapedChar(str, "|");
}

export const splitByOperator = (str: SplitString[]): SplitString[][] => {
  const result: SplitString[][] = [];
  let lastI = 0;
  for (let i = 0; i < str.length; i++) {
    const stringPart = str[i];
    if (stringPart.type !== "space") {
      continue;
    }
    if (["and", "or", "not"].includes(stringPart.value.toLowerCase())) {
      result.push(str.slice(lastI, i));
      result.push([stringPart]); // seperate operator
      lastI = i + 1;
    }
  }
  if (lastI < str.length) {
    result.push(str.slice(lastI));
  }
  return result;
}
