import { css } from "@emotion/css";
import React, { useState } from 'react';

import { CoreApp, GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from "../../../datasource";
import { Query, VisualQuery } from "../../../types";
import { AdHocFiltersControl } from "../AdHocFiltersControl";

import QueryBuilder from "./QueryBuilder";
import { buildVisualQueryFromString } from "./utils/parseFromString";
import { parseVisualQueryToString } from "./utils/parseToString";


export interface Props {
  query: Query;
  app?: CoreApp;
  datasource: VictoriaLogsDatasource;
  onChange: (update: Query) => void;
  onRunQuery: () => void;
  timeRange?: TimeRange;
}

export function QueryBuilderContainer(props: Props) {
  const styles = useStyles2(getStyles);

  const { query, onChange, onRunQuery, datasource, timeRange, app } = props

  const [state, setState] = useState<{expr: string, visQuery: VisualQuery}>({
    expr: query.expr,
    visQuery: buildVisualQueryFromString(query.expr).query
  })

  const onVisQueryChange = (visQuery: VisualQuery) => {
    const expr = parseVisualQueryToString(visQuery);
    setState({ expr, visQuery })
    onChange({ ...props.query, expr: expr });
  };

  const onAdhocFilterChange = (newQuery: Query) => {
    setState({ expr: query.expr, visQuery: buildVisualQueryFromString(newQuery.expr).query });
    onChange(newQuery);
  }

  return (
    <>
      <QueryBuilder
        query={state.visQuery}
        datasource={datasource}
        onChange={onVisQueryChange}
        onRunQuery={onRunQuery}
        timeRange={timeRange}
      />
      {query.extraFilters && <AdHocFiltersControl query={query} onChange={onAdhocFilterChange} onRunQuery={onRunQuery} app={app} />}

      <hr/>

      <p className={styles.previewText}>
        {query.expr !== '' && query.expr}
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
