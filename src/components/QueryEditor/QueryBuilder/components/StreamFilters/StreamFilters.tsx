import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, IconButton, Label, Text, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { Query, StreamFilterState } from '../../../../../types';

import StreamFilterRow from './StreamFilterRow';
import { buildPrecedingStreamFilters, getUsedLabelNames } from './streamFilterUtils';

const TooltipText = () => (
  <Text>
    Stream filters improve query performance by narrowing the search to specific log streams before executing the rest
    of the query.
    <br />
    Instead of scanning all logs, VictoriaLogs first selects only the relevant streams (e.g. {"{app='nginx'}"}), which
    significantly reduces the amount of data to process and makes queries faster and more efficient.
    <br />
    Stream filters are applied as extra_stream_filters parameter.
    <br />
    Stream labels depend on the query&#39;s input.
  </Text>
);

interface Props {
  datasource: VictoriaLogsDatasource;
  query: Query;
  timeRange?: TimeRange;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
}

export const StreamFilters = ({ datasource, query, timeRange, onChange, onRunQuery }: Props) => {
  const styles = useStyles2(getStyles);
  const EMPTY_FILTER: StreamFilterState = useMemo(() => ({ label: '', operator: 'in', values: [] }), []);
  const savedFilters = useMemo(() => query.streamFilters || [], [query]);
  const displayFilters = useMemo(
    () => (savedFilters.length === 0 ? [EMPTY_FILTER] : savedFilters),
    [savedFilters, EMPTY_FILTER]
  );

  const handleAddFilter = useCallback(() => {
    const newFilters: StreamFilterState[] = [...savedFilters, { label: '', operator: 'in', values: [] }];
    onChange({ ...query, streamFilters: newFilters });
  }, [onChange, query, savedFilters]);

  const handleFilterChange = useCallback(
    (index: number, filter: StreamFilterState) => {
      const isPlaceholder = index >= savedFilters.length;
      if (isPlaceholder) {
        if (filter.label) {
          onChange({ ...query, streamFilters: [...savedFilters, filter] });
        }
        return;
      }
      const newFilters = [...savedFilters];
      newFilters[index] = filter;
      onChange({ ...query, streamFilters: newFilters });
    },
    [onChange, query, savedFilters]
  );

  const handleRemoveFilter = useCallback(
    (index: number) => {
      const isPlaceholder = index >= savedFilters.length;
      if (isPlaceholder) {
        return;
      }
      const newFilters = savedFilters.filter((_, i) => i !== index);
      onChange({
        ...query,
        streamFilters: newFilters.length > 0 ? newFilters : undefined,
      });
    },
    [onChange, query, savedFilters]
  );

  // Precompute extra_stream_filters for each filter row (from preceding enabled filters)
  const precedingFiltersMap = useMemo(() => {
    return displayFilters.map((_, index) => buildPrecedingStreamFilters(displayFilters, index));
  }, [displayFilters]);

  // Precompute excluded label names for each filter row
  const excludeLabelsMap = useMemo(() => {
    return displayFilters.map((_, index) => getUsedLabelNames(displayFilters, index));
  }, [displayFilters]);

  return (
    <div className={styles.wrapper}>
      <Label className={styles.label}>
        Stream filters
        <IconButton style={{ marginLeft: '5px' }} name='info-circle' tooltip={TooltipText} />
      </Label>
      <div className={styles.filtersRow}>
        {displayFilters.map((filter, index) => (
          <StreamFilterRow
            key={filter.label + filter.operator}
            datasource={datasource}
            filter={filter}
            timeRange={timeRange}
            extraStreamFilters={precedingFiltersMap[index]}
            excludeLabels={excludeLabelsMap[index]}
            queryExpr={query.expr}
            onChange={(f) => handleFilterChange(index, f)}
            onRemove={() => handleRemoveFilter(index)}
            onRunQuery={onRunQuery}
          />
        ))}
        <div className={styles.controls}>
          <Button variant='secondary' onClick={handleAddFilter} icon='plus' size='md' aria-label='Add stream filter' />
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(0.5)};
      margin-bottom: ${theme.spacing(1)};
    `,
    label: css`
      margin-bottom: 0;
    `,
    filtersRow: css`
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${theme.spacing(1)};
    `,
    controls: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
      justify-content: center;
    `,
  };
};
