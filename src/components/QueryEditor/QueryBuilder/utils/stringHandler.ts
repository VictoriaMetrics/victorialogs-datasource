import { VictoriaLogsOperationId } from "../Operations"

import { SplitString } from "./stringSplitter";

function mustQuote(str: string): boolean {
    const value = str.trim().toLowerCase();
    const commands = Object.values(VictoriaLogsOperationId);
    if (commands.includes(value as VictoriaLogsOperationId)) {
        return true;
    }
    const keywords = [
        "by", "limit", "as", "from", "keep_original_fields",
        "skip_empty_results", "if", "prettify", "max_values_per_field",
        "max_value_len", "keep_const_fields", "partition", "desc",
        "inner", "prefix", "offset", "before", "after", "time_window",
        "hits", "rank", "with", "result_prefix", "fields", "from",
        "drop_duplicates", "concurrency", "ignore_global_time_filter",
        "i", "at", "in"
    ];
    if (keywords.includes(value)) {
        return true;
    }
    const chars = [" ", "'", "\"", "`", ":", "=", "#", ">", "<", ",", "(", ")", "[", "]", "{", "}", "+", "-", "/", "%", "|", "&", "^", "~", "!", ";", "?", "@", "\\", "*"];
    if (chars.some(char => value.includes(char))) {
        return true;
    }
    return false;
}

export const quoteString = (str: string, forceQuote?: boolean): string => {
    if (!mustQuote(str) && !forceQuote) {
        if (!(str.trim() === "" && forceQuote === false)) { // so that if forceQuote is false an empty string gets quoted
            return str;
        }
    }
    if (!str.includes("`")) {
        return `\`${str}\``;
    }
    if (!str.includes('"')) {
        return `"${str.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
    }
    if (!str.includes("'")) {
        return `'${str.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
    }
    return `\`${str.replaceAll('`', '\\`')}\``;
}

export const unquoteString = (str: string): string => {
    if (str.startsWith('"') && str.endsWith('"')) {
        return str.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', "\\");
    }
    if (str.startsWith("'") && str.endsWith("'")) {
        return str.slice(1, -1).replaceAll("\\'", "'").replaceAll('\\\\', "\\");
    }
    if (str.startsWith('`') && str.endsWith('`')) {
        return str.slice(1, -1).replaceAll('\\`', '`');
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
