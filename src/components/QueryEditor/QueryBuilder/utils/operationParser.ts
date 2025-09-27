import { QueryBuilderOperation, VisualQueryModeller } from "@grafana/plugin-ui";

import { checkLegacyMultiExact } from "../Editors/SubqueryEditor";
import { VictoriaLogsOperationId } from "../Operations";
import { QueryModeller } from "../QueryModellerClass";
import { VictoriaLogsQueryOperationCategory } from "../VictoriaLogsQueryOperationCategory";

import { unquoteString } from "./stringHandler";
import { SplitString } from "./stringSplitter";

export const getValuesFromBrackets = (str: SplitString[], removeQuotes = true): string[] => {
    if (str.length === 0) {
        return [];
    }
    let result: string[] = [];
    for (const { type, value } of str) {
        if (type === "quote") {
            result.push(removeQuotes ? unquoteString(value) : value);
        } else if (type === "space" && value !== ",") {
            result.push(value);
        }
    }
    return result;
}

export const getConditionFromString = (str: SplitString[]): string => {
    if (str.length < 2) {
        return "";
    }
    let condition = "";
    if (str[0].type === "space" && str[0].value === "if" && str[1].type === "bracket") { // if (condition)
        condition = str[1].raw_value.slice(1, -1);
        str.shift();
        str.shift();
    } else if (str[0].type === "bracket" && str[0].prefix === "if") { // if(condition)
        condition = str[0].raw_value.slice(1, -1);
        str.shift();
    }
    return condition;
}

export const isStatFunction = (str: string): boolean => {
    return false;
}

export const isFilterFunction = (str: string): boolean => {
    return false;
}

export const getFieldName = (str: SplitString[]): string | undefined => {
    if (str.length === 0) {
        return;
    }
    let fieldName = undefined;
    const { type: firstType, value: firstValue } = str[0];
    const { type: secondType, value: secondValue } = str[1] || {};
    const firstIsColon = firstType === "colon";
    const isSpaceColon = firstType === "space" && secondType === "colon" && secondValue === "";
    const isQuoteColon = firstType === "quote" && secondType === "colon" && secondValue === "";
    if (firstIsColon) {
        fieldName = firstValue;
        str.shift();
    } else if (isQuoteColon) {
        fieldName = unquoteString(firstValue).trim();
        str.shift();
        str.shift();
    } else if (isSpaceColon && !isFilterFunction(firstValue) && !isStatFunction(firstValue)) {
        fieldName = firstValue;
        str.shift();
        str.shift();
    }
    return fieldName;
}

export const getFunctionName = (str: SplitString[]) => {
    if (str.length === 0) {
        return "";
    }
    if (str[0].type === "quote" || str[0].type === "colon") {
        return "";
    }
    if (str[0].type === "bracket" && str[0].prefix !== "") {
        return str[0].prefix;
    }
    if (str.length > 1) {
        if (str[0].type === "space" && str[1].type === "bracket" && str[1].prefix === "") {
            return str[0].value;
        }
    }
    return "";
}

const getOperationFromId = (queryModeller: QueryModeller, id: string, str: SplitString[], fieldName: string | undefined) => {
    const operation = queryModeller.getOperationDefinition(id);
    if (operation) {
        const orioginalLength = str.length;
        const { params, length } = operation.splitStringByParams(str, fieldName);
        const deltaLength = orioginalLength - str.length;
        return { operation: { id, params }, length: length - deltaLength };
    }
    return;
}

export const parseStatsOperation = (str: SplitString[], queryModeller: VisualQueryModeller): { operation: QueryBuilderOperation, length: number } | undefined => {
    let firstWord = "";
    if (str.length > 0) {
        if (str[0].type === "space") {
            firstWord = str[0].value.toLowerCase();
        } else if (str[0].type === "bracket") {
            firstWord = str[0].prefix.toLowerCase();
        } else {
            return;
        }
    }
    if (firstWord === "") {
        return;
    }
    for (const operation of (queryModeller as QueryModeller).getOperationsForCategory(VictoriaLogsQueryOperationCategory.Stats)) {
        if (operation.id.toLowerCase() === firstWord) {
            const orioginalLength = str.length;
            const { params, length } = operation.splitStringByParams(str);
            const deltaLength = orioginalLength - str.length;
            return { operation: { id: operation.id, params }, length: length - deltaLength };
        }
    }
    return;
}

export const parseOperation = (str: SplitString[], onlyFilters: boolean, queryModeller: QueryModeller): { operation: QueryBuilderOperation, length: number } | undefined => {
    const fieldName = getFieldName(str);
    switch (fieldName) {
        case "_time":
            const fnName = getFunctionName(str);
            if (fnName === VictoriaLogsOperationId.DayRange) {
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.DayRange, str, fieldName);
            } else if (fnName === VictoriaLogsOperationId.WeekRange) {
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.WeekRange, str, fieldName);
            } else {
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.Time, str, fieldName);
            }
        case "_stream":
            return getOperationFromId(queryModeller, VictoriaLogsOperationId.Stream, str, fieldName);
        case "_stream_id":
            return getOperationFromId(queryModeller, VictoriaLogsOperationId.StreamId, str, fieldName);
    }

    if (str.length > 0) {
        if (str[0].type === "bracket" && str[0].prefix === "") {
            if (str[0].raw_value.startsWith("(")) {
                const value = str[0].value;
                if (value.length === 1 && value[0].type === "space" && value[0].value.startsWith("$")) {
                    return getOperationFromId(queryModeller, VictoriaLogsOperationId.FieldContainsAnyValueFromVariable, str, fieldName);
                }
                if (checkLegacyMultiExact(value)) { // (="error" OR ="fatal")
                    return getOperationFromId(queryModeller, VictoriaLogsOperationId.MultiExact, str, fieldName);
                }
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.Logical, str, fieldName);
            }
            if (str[0].raw_value.startsWith("{")) {
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.Stream, str, fieldName);
            }
        }

        if ((fieldName === undefined) && (str[0].type === "space" || str[0].type === "bracket") && !onlyFilters) { // pipes have no field and are not quoted
            let firstWord;
            switch (str[0].type) {
                case "space":
                    firstWord = str[0].value;
                    break;
                case "bracket":
                    firstWord = str[0].prefix;
                    break;
            }
            switch (firstWord) { // special cases for pipes
                case "json_array_len":
                    return getOperationFromId(queryModeller, VictoriaLogsOperationId.JsonArrayLen, str, fieldName);
                case "hash":
                    return getOperationFromId(queryModeller, VictoriaLogsOperationId.Hash, str, fieldName);
                case "len":
                    return getOperationFromId(queryModeller, VictoriaLogsOperationId.Len, str, fieldName);
                case "eval":
                    str.shift();
                    return getOperationFromId(queryModeller, VictoriaLogsOperationId.Math, str, fieldName);
                case "filter":
                case "where":
                    str.shift();
                    return parseOperation(str, true, queryModeller);
                case "keep":
                    str.shift();
                    return getOperationFromId(queryModeller, VictoriaLogsOperationId.Fields, str, fieldName);
            }
            const pipeOperationIds = queryModeller.getOperationsForCategory(VictoriaLogsQueryOperationCategory.Pipes)
                .map(op => op.id.toLowerCase());
            if (pipeOperationIds.includes(firstWord)) {
                str.shift();
                return getOperationFromId(queryModeller, firstWord as VictoriaLogsOperationId, str, fieldName);
            }
        }

        if (str[0].type === "space" && str[0].value.startsWith("~")) {
            return getOperationFromId(queryModeller, VictoriaLogsOperationId.Regexp, str, fieldName);
        }
        if (str[0].value === "=" || (str.length > 1 && str[0].value === "!" && str[1].value === "=")) {
            return getOperationFromId(queryModeller, VictoriaLogsOperationId.Exact, str, fieldName);
        }
        if (str[0].type === "space" && str[0].value.startsWith("*")) {
            if (str.length > 2 && str[0].value === "*" && str[1].type === "quote" && str[2].value === "*") {
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.Substring, str, fieldName);
            }
            if (str.length > 0) {
                const value = str[0].value
                if (value.length > 1 && value.startsWith("*") && value.endsWith("*")) {
                    return getOperationFromId(queryModeller, VictoriaLogsOperationId.Substring, str, fieldName);
                }
            }
        }

        const functionName = getFunctionName(str);
        if (functionName !== "") {
            // Filters
            const filterOperationIds = ["pattern_match", "day_range", "week_range", "contains_all", "contains_any", "seq", "range", "ipv4_range", "string_range", "len_range", "value_type", "eq_field", "le_field", "lt_field", "equals_common_case", "contains_common_case"];
            if (filterOperationIds.includes(functionName.toLowerCase())) {
                return getOperationFromId(queryModeller, functionName.toLowerCase() as VictoriaLogsOperationId, str, fieldName);
            } else if (functionName.toLowerCase() === "in") {
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.MultiExact, str, fieldName);
            } else if (functionName.toLowerCase() === "options" && !onlyFilters) {
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.Options, str, fieldName);
            } else if (functionName.toLowerCase() === "pattern_match_full") {
                return getOperationFromId(queryModeller, VictoriaLogsOperationId.PatternMatch, str, fieldName);
            }
        }
        if (str[0].type === "space" && [">", "<"].includes(str[0].value.slice(0, 1))) {
            // comparisons >, <, >=, <=
            return getOperationFromId(queryModeller, VictoriaLogsOperationId.RangeComparison, str, fieldName);
        } else if (str[0].type === "space" && ["!", "-"].includes(str[0].value.slice(0, 1))) {
            // NOT Operator
            str.shift();
            return { operation: { id: VictoriaLogsOperationId.NOT, params: [] }, length: 0 };
        }
        const statsOperation = parseStatsOperation(str, queryModeller);
        if (statsOperation) {
            return statsOperation;
        }
    }
    if (str.length > 0 || (fieldName !== undefined)) {
        // Word
        return getOperationFromId(queryModeller, VictoriaLogsOperationId.Word, str, fieldName);
    }
    return;
}
