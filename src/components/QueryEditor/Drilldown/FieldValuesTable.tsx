import React, { useCallback, useMemo } from 'react';

import { AbsoluteTimeRange, DataFrame, LoadingState, TimeRange } from '@grafana/data';
import { IconButton } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { Query } from '../../../types';

import { buildValueVolumeQuery } from './queries/drilldownQueries';
import { useFieldValuesList } from './queries/useListQueries';
import { useValueLogsSample } from './queries/useLogsSampleQueries';
import { useFieldValueFrames } from './queries/useVolumeQueries';
import { BreakdownTable, BreakdownTableItem, ProvidedRowVolumes, TransformedVolume } from './shared/BreakdownTable';
import { ExpandedLogsPanel } from './shared/ExpandedLogsPanel';
import { STACKED_BARS_CHART_FIELD_CONFIG, getLevelGrouping, transformLevelVolume } from './shared/levelVolume';

interface FieldValuesTableProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  field: string;
  range: TimeRange;
  onFilterClick: (field: string, value: string, operator: '=' | '!=') => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/**
 * Field-values breakdown in the same two phases as the patterns table: an exact list first,
 * then the per-row volumes that fill the sparklines and the top chart
 */
export const FieldValuesTable: React.FC<FieldValuesTableProps> = ({
  datasource,
  query,
  field,
  range,
  onFilterClick,
  onChangeTimeRange,
}) => {
  const { values, loading, error, serverTruncated } = useFieldValuesList(datasource, query, field, range);
  // one grouped hits query supplies the volumes of every visible row. A row it does not
  // cover, on a deep page or past tuple truncation, falls back to its own query in the table
  const grouped = useFieldValueFrames(datasource, query, field, range);

  const items = useMemo<BreakdownTableItem[]>(
    () => values.map((v) => ({ label: v.value, total: v.total })),
    [values]
  );

  const rowVolumes = useMemo<ProvidedRowVolumes>(
    () => ({
      byLabel: new Map(grouped.groups.map((g) => [g.value, { frames: g.frames, total: g.total }])),
      state: grouped.loading ? LoadingState.Loading : grouped.error ? LoadingState.Error : LoadingState.Done,
    }),
    [grouped.groups, grouped.loading, grouped.error]
  );

  const buildVolumeQuery = useCallback(
    // the query groups by the level fields too, so each sparkline can stack by level
    (label: string, refIdSuffix: number) =>
      buildValueVolumeQuery(query, field, label, getLevelGrouping(datasource), range, refIdSuffix),
    [datasource, query, field, range]
  );

  const transformVolume = useCallback(
    (frames: DataFrame[], r: TimeRange): TransformedVolume => transformLevelVolume(datasource, frames, r),
    [datasource]
  );

  const renderActions = useCallback(
    (label: string) => (
      <>
        <IconButton
          name='search-plus'
          aria-label={`Filter for ${field}=${label}`}
          tooltip={`Filter for ${field}=${label}`}
          onClick={() => onFilterClick(field, label, '=')}
        />
        <IconButton
          name='search-minus'
          aria-label={`Filter out ${field}=${label}`}
          tooltip={`Filter out ${field}=${label}`}
          onClick={() => onFilterClick(field, label, '!=')}
        />
      </>
    ),
    [field, onFilterClick]
  );

  const renderExpandedRow = useCallback(
    (label: string, index: number) => (
      <ValueExpandedLogs datasource={datasource} query={query} field={field} value={label} range={range} index={index} />
    ),
    [datasource, query, field, range]
  );

  return (
    <BreakdownTable
      // a different field is a different table, so remount it and drop the search, legend and page state
      key={field}
      items={items}
      loading={loading}
      error={error}
      serverTruncated={serverTruncated}
      noun='values'
      searchPlaceholder='Search values'
      datasource={datasource}
      range={range}
      buildVolumeQuery={buildVolumeQuery}
      rowVolumes={rowVolumes}
      transformVolume={transformVolume}
      chartFieldConfig={STACKED_BARS_CHART_FIELD_CONFIG}
      renderActions={renderActions}
      renderExpandedRow={renderExpandedRow}
      onChangeTimeRange={onChangeTimeRange}
    />
  );
};

interface ValueExpandedLogsProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  field: string;
  value: string;
  range: TimeRange;
  index: number;
}

const ValueExpandedLogs: React.FC<ValueExpandedLogsProps> = ({ datasource, query, field, value, range, index }) => {
  const logsData = useValueLogsSample(datasource, query, field, value, range, true, index);
  return <ExpandedLogsPanel data={logsData} title={`${field}=${value} logs`} />;
};
