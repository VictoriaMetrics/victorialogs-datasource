import { useMemo } from "react";

import { QueryHintSection } from "./types";

export const usePlotPiechartHistogramHintsSection = (): QueryHintSection => {
  return useMemo((): QueryHintSection => {
    return {
      title: "Plot Piechart or Histogram",
      hints: [
        {
          title: "Top values by field",
          queryExpr: "<q> | stats by (<field>) count() rows",
          example: "* | stats by (level) count() rows",
          description: "Count logs grouped by a field (good for pie charts)",
          id: "stats-pipe",
        },
        {
          title: "Distribution by field",
          queryExpr: "<q> | stats by (<field>) count() as hits | sort by (hits desc)",
          example: "* | stats by (method) count() as hits | sort by (hits desc)",
          description: "See which values of field are most common",
          id: "stats-pipe"
        },
        {
          title: "Custom bucket intervals",
          queryExpr: "<q> | stats by (<field>:<interval>) count() requests",
          example: "* | stats by (request_size_bytes:10KB) count() requests",
          description: "Group values into custom-sized buckets",
          id: "stats-by-field-buckets"
        },
        {
          title: "Distribution by IP subnets",
          queryExpr: "<q> | stats by (<ip_field>:/24) count() rows | last 10 by (rows)",
          example: "* | stats by (ip:/24) count() rows | last 10 by (rows)",
          description: "Analyze logs by IP address ranges",
          id: "stats-by-ipv4-buckets"
        },
      ],
    };
  }, []);
};
