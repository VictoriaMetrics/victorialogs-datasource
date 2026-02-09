import { useMemo } from "react";

import { QueryHintSection } from "./types";

export const usePlotTimeSeriesHintsSection = (): QueryHintSection => {
  return useMemo((): QueryHintSection => {
    return {
      title: "Plot Time Series Panel",
      hints: [
        {
          title: "Count logs per minute",
          queryExpr: "<q> | stats by (_time:1m) count() as logs_total",
          example: "* | stats by (_time:1m) count() as logs_total",
          description: "Calculate log count for each minute",
          id: "stats-pipe"
        },
        {
          title: "Count errors per hour",
          queryExpr: "<word> | stats by (_time:1h) count() rows | sort by (_time)",
          example: "error | stats by (_time:1h) count() rows | sort by (_time)",
          description: "Count error logs grouped by hour",
          id: "stats-pipe"
        },
        {
          title: "Stats with additional filters",
          queryExpr: "<q> | stats by (_time:5m) count() if (<word1>) as <result_field1>, count() if (<word2>) as <result_field2>, count() as <result_field3>",
          example: `* | stats by (_time:5m)
  count() if (error) as errors,
  count() if (warn) as warnings,
  count() as total`,
          description: "Track multiple log levels over time",
          id: "stats-with-additional-filters"
        },
        {
          title: "Time series grouped by field",
          queryExpr: "<q> | stats by (_time:5m, <field>) count() as hits",
          example: "* | stats by (_time:5m, host) count() as hits",
          description: "Create multiple series, one per host",
          id: "stats-pipe"
        },
        {
          title: "Calculate error percentage",
          queryExpr: "<q> | stats count() <field1>, count() if (<word>) <field2> | math <field1> / <field2>",
          example: "* | stats count() logs, count() if (error) errors | math errors / logs",
          description: "Calculate the ratio of errors to total logs",
          id: "math-pipe"
        },
      ],
    };
  }, []);
};
