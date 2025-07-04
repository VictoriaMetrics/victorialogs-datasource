
import { css } from "@emotion/css";
import React, { memo } from 'react';

import { GrafanaTheme2, TimeRange, DataSourceApi } from "@grafana/data";
import {
  OperationList,
} from '@grafana/plugin-ui';
import { useStyles2 } from "@grafana/ui";

import { VictoriaLogsDatasource } from "../../../datasource";
import { VisualQuery } from "../../../types";

import { queryModeller } from "./QueryModeller";

interface Props {
  query: VisualQuery;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onChange: (update: VisualQuery) => void;
  onRunQuery: () => void;
}

const QueryBuilder = memo<Props>(({ datasource, query, onChange, onRunQuery, timeRange }) => {
  const styles = useStyles2(getStyles);

  const onVisQueryChange = (visQuery: VisualQuery) => {
    const expr = queryModeller.renderQuery(visQuery);
    onChange({ ...visQuery, expr: expr });
  };
  return (
    <div className={styles.builderWrapper}>
      <OperationList
        query={query}
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
