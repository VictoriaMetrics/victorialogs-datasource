import { useMemo } from 'react';

import { QueryHintSection } from './types';

export const usePrintRecentLogsHintsSection = (): QueryHintSection => {
  return useMemo((): QueryHintSection => {
    return {
      title: 'Print Recent Logs',
      hints: [
        {
          title: 'All logs',
          queryExpr: '<q>',
          example: '*',
          description: 'Show all available logs',
        },
        {
          title: 'Basic facets analysis',
          queryExpr: '<q> | facets',
          example: 'error | facets',
          description: 'Returns the most frequent values for every seen log field',
          id: 'facets-pipe'
        },
        {
          title: 'Top 10 applications by log count',
          queryExpr: '<q> | top N by (field1, ..., fieldN)',
          example: '* | top 10 by (_stream)',
          description: 'Find the applications generating the most logs',
          id: 'top-pipe',
        },
        {
          title: 'Last 10 logs sorted by time',
          queryExpr: '<q> | first N by (fields)',
          example: '* | first 10 by (_time desc)',
          description: 'Get the 10 most recent log entries',
          id: 'first-pipe'
        },
        {
          title: 'Logs with sorting',
          queryExpr: '<q> | sort by (field1, ..., fieldN)',
          example: '* | sort by (_time)',
          description: 'Show logs sorted by timestamp',
          id: 'sort-pipe'
        },
        {
          title: 'Logs containing a specific word in log message',
          queryExpr: '<word>',
          example: 'error',
          description: "Find logs with 'error' word, sorted by time",
          id: 'word-filter'
        },
        {
          title: 'Logs from a specific application via stream filter',
          queryExpr: '{label="<label_name>"} <q>',
          example: '{app="nginx"} error',
          description: 'Filter logs by application stream and keyword',
          id: 'stream-filter'
        },
        {
          title: 'Count unique values',
          queryExpr: '<q> | uniq by (<field>)',
          example: '* | uniq by (ip)',
          description: 'Get unique values for a field',
          id: 'uniq-by-pipe'
        },
      ],
    };
  }, []);
};
