import { css } from "@emotion/css";
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from "../../../datasource";
import { VisualQuery } from "../../../types";

import QueryBuilder from "./QueryBuilder";
import { parseExprToVisualQuery } from "./QueryModeller";

export interface Props<Q extends { expr: string;[key: string]: any } = { expr: string;[key: string]: any }> {
  query: Q;
  datasource: VictoriaLogsDatasource;
  onChange: (update: Q) => void;
  onRunQuery: () => void;
  timeRange?: TimeRange;
  enableLabelFilters: boolean;
}

export function QueryBuilderContainer<Q extends { expr: string;[key: string]: any } = { expr: string;[key: string]: any }>(props: Props<Q>) {
  const styles = useStyles2(getStyles);

  const { query, onChange, onRunQuery, datasource, timeRange, enableLabelFilters } = props;

  const visQuery = useMemo(() => {
    return parseExprToVisualQuery(query.expr, "_msg", undefined, enableLabelFilters).query;
  }, [query.expr, enableLabelFilters]);

  const [state, setState] = useState<{ expr: string, visQuery: VisualQuery }>({
    expr: query.expr,
    visQuery: visQuery,
  })

  const onVisQueryChange = (visQuery: VisualQuery) => {
    setState({ expr: visQuery.expr, visQuery })
    onChange({ ...props.query, expr: visQuery.expr });
  };
  return (
    <>
      <QueryBuilder
        query={state.visQuery}
        datasource={datasource}
        onChange={onVisQueryChange}
        onRunQuery={onRunQuery}
        timeRange={timeRange}
        enableLabelFilters={enableLabelFilters}
      />
      <hr />

      <p className={styles.previewText}>
        {state.expr}
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
