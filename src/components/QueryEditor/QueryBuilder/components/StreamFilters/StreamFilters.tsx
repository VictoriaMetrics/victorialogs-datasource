import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, IconButton, Label, Text, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { Query, StreamFilterState } from '../../../../../types';

import StreamFilterRow from './StreamFilterRow';
import { buildPrecedingStreamFilters, getUsedLabelNames } from './streamFilterUtils';


const TooltipText = () =>
  <Text>
    Stream filters improve query performance by narrowing the search to specific log streams before executing the rest
    of the query.<br />
    Instead of scanning all logs, VictoriaLogs first selects only the relevant streams (e.g. {"{app='nginx'}"}), which
    significantly reduces the amount of data to process and makes queries faster and more efficient.<br />
    Stream filters are applied as extra_stream_filters parameter
  </Text>
;

interface Props {
  datasource: VictoriaLogsDatasource;
  query: Query;
  timeRange?: TimeRange;
  onChange: (query: Query) => void;
}

export const StreamFilters = ({ datasource, query, timeRange, onChange }: Props) => {
  const styles = useStyles2(getStyles);
  const streamFilters = useMemo(() => query.streamFilters || [], [query]);

  const handleAddFilter = useCallback(() => {
    const newFilters: StreamFilterState[] = [...streamFilters, { label: '', operator: '=', values: [] }];
    onChange({ ...query, streamFilters: newFilters });
  }, [onChange, query, streamFilters]);

  const handleFilterChange = useCallback(
    (index: number, filter: StreamFilterState) => {
      const newFilters = [...streamFilters];
      newFilters[index] = filter;
      onChange({ ...query, streamFilters: newFilters });
    },
    [onChange, query, streamFilters]
  );

  const handleRemoveFilter = useCallback(
    (index: number) => {
      const newFilters = streamFilters.filter((_, i) => i !== index);
      onChange({
        ...query,
        streamFilters: newFilters.length > 0 ? newFilters : undefined,
      });
    },
    [onChange, query, streamFilters]
  );

  // Precompute extra_stream_filters for each filter row (from preceding enabled filters)
  const precedingFiltersMap = useMemo(() => {
    return streamFilters.map((_, index) => buildPrecedingStreamFilters(streamFilters, index));
  }, [streamFilters]);

  // Precompute excluded label names for each filter row
  const excludeLabelsMap = useMemo(() => {
    return streamFilters.map((_, index) => getUsedLabelNames(streamFilters, index));
  }, [streamFilters]);

  return (
    <div className={styles.wrapper}>
      <Label className={styles.label}>
        Stream filters
        <IconButton
          style={{ marginLeft: '5px' }}
          name='info-circle'
          tooltip={TooltipText}
        />
      </Label>
      <div className={styles.filtersRow}>
        {streamFilters.map((filter, index) => (
          <StreamFilterRow
            key={filter.label + filter.operator}
            datasource={datasource}
            filter={filter}
            timeRange={timeRange}
            extraStreamFilters={precedingFiltersMap[index]}
            excludeLabels={excludeLabelsMap[index]}
            onChange={(f) => handleFilterChange(index, f)}
            onRemove={() => handleRemoveFilter(index)}
          />
        ))}
        <div className={styles.addButton}>
          <Button variant='secondary' onClick={handleAddFilter} icon='plus'>
            Stream filter
          </Button>
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
    addButton: css`
      align-self: flex-end;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
  };
};
