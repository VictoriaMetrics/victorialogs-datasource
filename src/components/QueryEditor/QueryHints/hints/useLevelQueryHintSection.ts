import { groupBy } from "lodash";
import { useMemo } from "react";

import { LogLevel } from "@grafana/data";

import {
  OperatorLabels,
  possibleLogValueByLevelType,
  UNIQ_LOG_LEVEL,
  UniqLogLevelKeys
} from "../../../../configuration/LogLevelRules/const";
import { LogLevelRule } from "../../../../configuration/LogLevelRules/types";

import { QueryHint, QueryHintSectionBase } from "./types";

type LevelHint = Pick<QueryHint, "title" | "queryExpr">;

export const useLevelQueryHintSection = (levelRules: LogLevelRule[]): QueryHintSectionBase<LevelHint> => {
  return useMemo(() => {
    const enabledLevelRules = levelRules.filter(rule => rule.enabled);
    const groupedByLevelRules = groupBy(enabledLevelRules, "level");
    const levelFilters = Object
      .values(UNIQ_LOG_LEVEL)
      .filter(val => val !== LogLevel.unknown)
      .reduce((acc, logLevel) => {
        acc[logLevel] = groupedByLevelRules[logLevel] || [];
        return acc;
      }, {} as Record<UniqLogLevelKeys, LogLevelRule[]>);

    const hints = Object
      .entries(levelFilters)
      .map(([ruleLevel, rule]): LevelHint => {
        const levelKey = ruleLevel as UniqLogLevelKeys;
        const queryExprByRules = rule.map(r => `${r.field}:${OperatorLabels[r.operator]}"${r.value}"`);
        const possibleLevelValues = possibleLogValueByLevelType[levelKey].map(value => `"${value}"`).join(",");
        const queryExprByLevel = `level:contains_common_case(${possibleLevelValues})`;
        const queryParts = [queryExprByLevel];
        if (queryExprByRules.length > 0) {
          queryParts.push(...queryExprByRules);
        }
        const expr = queryParts.join(" OR ");
        return {
          title: levelKey,
          queryExpr: expr
        };
      });

    hints.push({
      title: LogLevel.unknown,
      queryExpr: `!(${hints.map(hint => hint.queryExpr).join(" OR ")})`
    });

    return {
      title: "Filter by log level",
      hints
    };
  }, [levelRules]);
};
