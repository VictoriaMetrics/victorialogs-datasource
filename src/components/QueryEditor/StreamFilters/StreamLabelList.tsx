import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { ComboboxOption, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { useFetchStreamFilters } from '../shared/useFetchStreamFilters';

import { useStreamFiltersContext } from './StreamFiltersContext';
import { StreamLabelItem } from './StreamLabelItem';
import { StreamSearch } from './StreamSearch';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
  emptyText: string;
}

export const StreamLabelList: React.FC<Props> = ({
  datasource,
  timeRange,
  queryExpr,
  emptyText,
}) => {
  const styles = useStyles2(getStyles);
  const {
    popoverLabel,
    selectedExtraStreamFilters,
    handleLabelClick,
    isFetching,
    beginFetch,
    endFetch,
  } = useStreamFiltersContext();
  const { loadStreamFieldNames } = useFetchStreamFilters({
    datasource,
    timeRange,
    queryExpr,
    extraStreamFilters: selectedExtraStreamFilters,
  });
  const [labels, setLabels] = useState<ComboboxOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    beginFetch();
    // Don't reset to null — keep previous labels visible until the new fetch resolves.
    loadStreamFieldNames('')
      .then((opts) => {
        if (!cancelled) {
          setLabels(opts);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to load stream labels', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load stream labels');
      })
      .finally(() => {
        endFetch();
      });
    return () => {
      cancelled = true;
    };
  }, [loadStreamFieldNames, beginFetch, endFetch]);

  const filteredLabels = useMemo(() => {
    if (labels === null) {
      return null;
    }
    const query = search.trim().toLowerCase();
    if (!query) {
      return labels;
    }
    return labels.filter((opt) => (opt.value ?? '').toLowerCase().includes(query));
  }, [labels, search]);

  const renderedLabels = useMemo(() => {
    if (filteredLabels === null || filteredLabels.length === 0) {
      return null;
    }
    return filteredLabels.map((opt) => {
      const name = opt.value ?? '';
      if (!name) {
        return null;
      }
      return (
        <StreamLabelItem
          key={name}
          name={name}
          description={opt.description}
          active={popoverLabel === name}
          disabled={isFetching}
          onClick={handleLabelClick}
        />
      );
    });
  }, [filteredLabels, popoverLabel, handleLabelClick, isFetching]);

  let content: React.ReactNode = renderedLabels;
  if (loadError) {
    content = <EmptyMessage text={`Failed to load stream labels: ${loadError}`} />;
  } else if (labels !== null && labels.length === 0) {
    content = <EmptyMessage text={emptyText} />;
  } else if (filteredLabels !== null && filteredLabels.length === 0) {
    content = <EmptyMessage text='No matches' />;
  }

  return (
    <div className={styles.root}>
      <StreamSearch placeholder='Search fields' value={search} onChange={setSearch} />
      <div className={styles.list}>{content}</div>
    </div>
  );
};

const EmptyMessage: React.FC<{ text: string }> = ({ text }) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.empty}>{text}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  root: css`
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  `,
  list: css`
    display: flex;
    flex-direction: column;
    padding: ${theme.spacing(0.5, 0)};
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
  `,
  empty: css`
    padding: ${theme.spacing(0.75, 1)};
    color: ${theme.colors.text.secondary};
  `,
});
