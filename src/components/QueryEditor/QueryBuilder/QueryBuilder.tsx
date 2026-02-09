import { css } from '@emotion/css';
import React, { Fragment, memo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { FilterVisualQuery, VisualQuery } from '../../../types';

import QueryBuilderAddFilter from './components/QueryBuilderAddFilter';
import QueryBuilderFieldFilter from './components/QueryBuilderFilters/QueryBuilderFieldFilter';
import QueryBuilderSelectOperator from './components/QueryBuilderOperators/QueryBuilderSelectOperator';
import { DEFAULT_FILTER_OPERATOR } from './utils/parseToString';

interface Props {
  query: VisualQuery;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onChange: (update: VisualQuery) => void;
  onRunQuery: () => void;
}

const QueryBuilder = memo<Props>(({ datasource, query, onChange, timeRange }) => {
  const styles = useStyles2(getStyles);
  const { filters } = query;

  return (
    <div className={styles.builderWrapper}>
      <QueryBuilderFilter
        datasource={datasource}
        filters={filters}
        onChange={onChange}
        query={query}
        timeRange={timeRange}
        indexPath={[]}
      />
    </div>
  );
});

interface QueryBuilderFilterProps {
  datasource: VictoriaLogsDatasource;
  query: VisualQuery;
  filters: FilterVisualQuery;
  indexPath: number[];
  timeRange?: TimeRange;
  onChange: (query: VisualQuery) => void;
}

const QueryBuilderFilter = (props: QueryBuilderFilterProps) => {
  const styles = useStyles2(getStyles);
  const { datasource, filters, query, indexPath, timeRange, onChange } = props;
  const isRoot = !indexPath.length;
  return (
    <div className={isRoot ? styles.builderWrapper : styles.filterWrapper}>
      {filters.values.map((filter, index) => (
        <Fragment key={index}>
          <div className={styles.filterItem}>
            {typeof filter === 'string'
              ?
              <QueryBuilderFieldFilter
                datasource={datasource}
                indexPath={[...indexPath, index]}
                filter={filter}
                query={query}
                timeRange={timeRange}
                onChange={onChange}
              />
              :
              <QueryBuilderFilter
                datasource={datasource}
                indexPath={[...indexPath, index]}
                filters={filter}
                query={query}
                timeRange={timeRange}
                onChange={onChange}
              />
            }
          </div>
          {index !== filters.values.length - 1 && (
            <QueryBuilderSelectOperator
              query={query}
              operator={filters.operators[index] || DEFAULT_FILTER_OPERATOR}
              indexPath={[...indexPath, index]}
              onChange={onChange}
            />
          )}
        </Fragment>
      )
      )}
      {/* for new filters*/}
      {!filters.values.length && (
        <QueryBuilderFieldFilter
          datasource={datasource}
          indexPath={[...indexPath, filters.values.length]}
          filter={''}
          query={query}
          timeRange={timeRange}
          onChange={onChange}
        />
      )}
      <QueryBuilderAddFilter query={query} onAddFilter={onChange} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    builderWrapper: css`
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.spacing(1)};
    `,
    filterWrapper: css`
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.spacing(1)};
      border: 1px solid ${theme.colors.border.strong};
      background-color: ${theme.colors.border.weak};
      padding: ${theme.spacing(1)};
    `,
    filterItem: css`
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: ${theme.spacing(1)};
    `
  };
};

QueryBuilder.displayName = 'QueryBuilder';

export default QueryBuilder;
