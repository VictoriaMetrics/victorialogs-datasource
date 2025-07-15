
import { css } from "@emotion/css";
import React, { memo, useMemo } from 'react';

import { GrafanaTheme2, TimeRange, DataSourceApi } from "@grafana/data";
import { OperationList } from '@grafana/plugin-ui';
import { useStyles2 } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../../datasource";
import { VisualQuery } from "../../../types";

import { parseExprToVisualQuery } from "./QueryModeller";
import { QueryModeller } from "./QueryModellerClass";

interface Props {
  queryExpr: string;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onChange: (update: string) => void;
  onRunQuery: () => void;
}

const QueryBuilder = memo<Props>(({ datasource, queryExpr, onChange, onRunQuery, timeRange }) => {
  const styles = useStyles2(getStyles);
  const queryModeller = useMemo(() => {
    return new QueryModeller([]);
  }, []);
  const visQuery = useMemo(() => {
    return parseExprToVisualQuery(queryExpr, "_msg", queryModeller).query;
  }, [queryExpr, queryModeller]);

  const onVisQueryChange = (visQuery: VisualQuery) => {
    const expr = queryModeller.renderQuery(visQuery);
    onChange(expr);
  };
  return (
    <div className={styles.builderWrapper}>
      <OperationList
        query={visQuery}
        datasource={datasource as DataSourceApi}
        onChange={onVisQueryChange}
        timeRange={timeRange}
        onRunQuery={onRunQuery}
        queryModeller={queryModeller}
      />
    </div>
  )
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    builderWrapper: css`
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.spacing(1)};
    `,
  };
};

QueryBuilder.displayName = 'QueryBuilder';

export default QueryBuilder;
