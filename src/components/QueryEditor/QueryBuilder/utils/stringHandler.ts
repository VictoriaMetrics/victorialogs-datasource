import { SplitString } from "./stringSplitter";

export const quoteString = (str: string): string => {
    if (!str.includes(' ') && !str.includes('"') && !str.includes("'") && !str.includes('`') && !str.includes(":") && !str.includes("=")) {
        return str;
    }
    if (!str.includes("`")) {
        return `\`${str}\``;
    }
    if (!str.includes('"')) {
        return `"${str.replace('\\', '\\\\').replace('"', '\\"')}"`;
    }
    if (!str.includes("'")) {
        return `'${str.replace('\\', '\\\\').replace("'", "\\'")}'`;
    }
    return `\`${str.replace('`', '\\`')}\``;
}

export const unquoteString = (str: string): string => {
    if (str.startsWith('"') && str.endsWith('"')) {
        return str.slice(1, -1).replace('\\"', '"').replace('\\\\', "\\");
    }
    if (str.startsWith("'") && str.endsWith("'")) {
        return str.slice(1, -1).replace("\\'", "'").replace('\\\\', "\\");
    }
    if (str.startsWith('`') && str.endsWith('`')) {
        return str.slice(1, -1).replace('\\`', '`');
    }
    return str;
}

export const isValue = (str: SplitString): boolean => {
    return str.type === "quote" || str.type === "space";
}

export const getValue = (str: SplitString): string => {
    if (str.type === "quote") {
      return unquoteString(str.value);
    } else if (str.type === "space") {
        return str.value;
    }
    return "";
}
