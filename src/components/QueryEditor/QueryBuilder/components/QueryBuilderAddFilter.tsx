import { css } from "@emotion/css";
import React, { useCallback } from 'react';

import { GrafanaTheme2 } from "@grafana/data";
import { Button, useStyles2 } from "@grafana/ui";

import { VisualQuery } from "../../../../types";
import { DEFAULT_FILTER_OPERATOR } from "../utils/parseToString";

interface Props {
  query: VisualQuery;
  onAddFilter: (query: VisualQuery) => void;
}

const QueryBuilderAddFilter = ({ query, onAddFilter }: Props) => {
  const styles = useStyles2(getStyles);

  const handleAddFilter = useCallback(() => {
    onAddFilter({
      ...query, filters: {
        ...query.filters,
        values: [...query.filters.values, ''],
        operators: [...query.filters.operators, DEFAULT_FILTER_OPERATOR]
      }
    })
  }, [onAddFilter, query])

  return (
    <div className={styles.wrapper}>
      <Button
        variant={'secondary'}
        onClick={handleAddFilter}
        icon={'plus'}
      >
        {`Filter`}
      </Button>
    </div>
  )
}

const getStyles = (_theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      align-self: flex-end;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
  };
};

export default QueryBuilderAddFilter;
