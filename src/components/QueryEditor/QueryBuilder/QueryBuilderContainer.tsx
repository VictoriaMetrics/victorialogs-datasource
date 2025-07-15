import { css } from "@emotion/css";
import React from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from "../../../datasource";

import QueryBuilder from "./QueryBuilder";

export interface Props<Q extends { expr: string;[key: string]: any } = { expr: string;[key: string]: any }> {
  query: Q;
  datasource: VictoriaLogsDatasource;
  onChange: (update: Q) => void;
  onRunQuery: () => void;
  timeRange?: TimeRange;
}

export function QueryBuilderContainer<Q extends { expr: string;[key: string]: any } = { expr: string;[key: string]: any }>(props: Props<Q>) {
  const styles = useStyles2(getStyles);
  const { query, onChange, onRunQuery, datasource, timeRange } = props;
  const onVisQueryChange = (expr: string) => {
    onChange({ ...query, expr });
  };
  return (
    <>
      <QueryBuilder
        queryExpr={query.expr}
        datasource={datasource}
        onChange={onVisQueryChange}
        onRunQuery={onRunQuery}
        timeRange={timeRange}
      />
      <hr />

      <p className={styles.previewText}>
        {query.expr}
      </p>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    previewText: css`
      font-size: ${theme.typography.bodySmall.fontSize};
    `
  };
};
