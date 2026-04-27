import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { ComboboxOption, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';

import { StreamLabelItem } from './StreamLabelItem';
import { StreamValuesPopover } from './StreamValuesPopover/StreamValuesPopover';
import { useFetchStreamFilters } from './useFetchStreamFilters';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
  popoverLabel: string | null;
  selectedValuesForPopover: string[];
  sidebarExtraStreamFilters?: string;
  popoverExtraStreamFilters?: string;
  onLabelClick: (name: string) => void;
  onToggleValue: (value: string) => void;
  onClosePopover: () => void;
  emptyText: string;
}

export const StreamLabelList: React.FC<Props> = ({
  datasource,
  timeRange,
  queryExpr,
  popoverLabel,
  selectedValuesForPopover,
  sidebarExtraStreamFilters,
  popoverExtraStreamFilters,
  onLabelClick,
  onToggleValue,
  onClosePopover,
  emptyText,
}) => {
  const styles = useStyles2(getStyles);
  const { loadStreamFieldNames } = useFetchStreamFilters({
    datasource,
    timeRange,
    queryExpr,
    extraStreamFilters: sidebarExtraStreamFilters,
  });
  const [labels, setLabels] = useState<ComboboxOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      });
    return () => {
      cancelled = true;
    };
  }, [loadStreamFieldNames]);

  const renderedLabels = useMemo(() => {
    if (labels === null || labels.length === 0) {
      return null;
    }
    return labels.map((opt) => {
      const name = opt.value ?? '';
      if (!name) {
        return null;
      }
      const active = popoverLabel === name;
      return (
        <StreamLabelItem
          key={name}
          name={name}
          description={opt.description}
          active={active}
          popoverContent={
            active ? (
              <StreamValuesPopover
                datasource={datasource}
                timeRange={timeRange}
                queryExpr={queryExpr}
                label={name}
                selectedValues={selectedValuesForPopover}
                extraStreamFilters={popoverExtraStreamFilters}
                onToggle={onToggleValue}
              />
            ) : undefined
          }
          onClick={onLabelClick}
          onClose={onClosePopover}
        />
      );
    });
  }, [
    labels,
    popoverLabel,
    datasource,
    timeRange,
    queryExpr,
    selectedValuesForPopover,
    popoverExtraStreamFilters,
    onLabelClick,
    onToggleValue,
    onClosePopover,
  ]);

  let content: React.ReactNode = renderedLabels;
  if (loadError) {
    content = <EmptyMessage text={`Failed to load stream labels: ${loadError}`} />;
  } else if (labels !== null && labels.length === 0) {
    content = <EmptyMessage text={emptyText} />;
  }

  return (
    <div className={styles.list}>
      {content}
    </div>
  );
};

const EmptyMessage: React.FC<{ text: string }> = ({ text }) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.empty}>{text}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
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
