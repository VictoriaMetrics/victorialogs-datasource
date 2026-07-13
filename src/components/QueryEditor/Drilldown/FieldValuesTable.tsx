import React, { useCallback, useMemo } from 'react';

import { AbsoluteTimeRange, DataFrame, FieldConfigSource, LoadingState, LogLevel, TimeRange } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, Button, IconButton, LoadingPlaceholder } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { aggregateRawLogsVolume, extractLevel } from '../../../logsVolumeLegacy';
import { Query } from '../../../types';

import { DRILLDOWN_ROW_BARS, buildDrilldownRequest, buildValueVolumeQuery } from './queries/drilldownQueries';
import { useFieldValuesList } from './queries/useListQueries';
import { useValueLogsSample } from './queries/useLogsSampleQueries';
import { BreakdownTable, BreakdownTableItem, TransformedVolume } from './shared/BreakdownTable';
import { NoDataPlaceholder } from './shared/NoDataPlaceholder';
import { useElementWidth } from './shared/useElementWidth';

const EXPANDED_LOGS_HEIGHT = 260;

/** Stacked-bars styling for the top chart — one series per value, mirroring the drawer's volume panels */
const VALUES_CHART_FIELD_CONFIG: FieldConfigSource = {
  defaults: {
    unit: 'short',
    custom: { drawStyle: 'bars', fillOpacity: 100, lineWidth: 1, stacking: { mode: 'normal', group: 'A' } },
  },
  overrides: [],
};

interface FieldValuesTableProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  field: string;
  range: TimeRange;
  onFilterClick: (field: string, value: string, operator: '=' | '!=') => void;
  /** When set, each row gets a "Show logs" action (used by the main view to drill into a value) */
  onShowLogs?: (value: string) => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/**
 * Field-values breakdown in the same two-phase structure as the Patterns table:
 * an instant exact list from the indexed field_values endpoint, then lazy per-row
 * volumes for the sparklines and the legend-synced top chart
 */
export const FieldValuesTable: React.FC<FieldValuesTableProps> = ({
  datasource,
  query,
  field,
  range,
  onFilterClick,
  onShowLogs,
  onChangeTimeRange,
}) => {
  const { values, loading, error, serverTruncated } = useFieldValuesList(datasource, query, field, range);

  const items = useMemo<BreakdownTableItem[]>(
    () => values.map((v) => ({ label: v.value, total: v.total })),
    [values]
  );

  const buildVolumeQuery = useCallback(
    (label: string, refIdSuffix: number) => {
      // level fields are requested alongside so each value's sparkline can be split by level
      const levelFields = Array.from(
        new Set([...datasource.getActiveLevelRules().map((r) => r.field).filter(Boolean), 'level'])
      );
      return buildValueVolumeQuery(query, field, label, levelFields, range, refIdSuffix);
    },
    [datasource, query, field, range]
  );

  // sparkline: level-stacked colored series, same pipeline as the drill-in volume chart;
  // top chart: the levels summed back into one series per value (its palette color survives
  // because the level-fixed colors are stripped)
  const transformVolume = useCallback(
    (frames: DataFrame[], r: TimeRange): TransformedVolume => {
      const request = buildDrilldownRequest([], r, 'drilldown-value-volume-aggregate');
      // level-stacked bars: the aggregation's per-level frames already carry the bar styling,
      // colors and stacking used by the drawer's volume panels — render them as-is
      const perLevel = aggregateRawLogsVolume(frames, extractLevel, request, datasource.logLevelRules, DRILLDOWN_ROW_BARS);
      const summed = aggregateRawLogsVolume(frames, () => LogLevel.unknown, request, [], DRILLDOWN_ROW_BARS).map(
        (frame) => ({
          ...frame,
          // drop the level styling (grey "unknown") so the top chart assigns palette colors
          fields: frame.fields.map((f) => ({ ...f, config: {} })),
        })
      );
      return { sparkline: { series: perLevel, state: LoadingState.Done, timeRange: r }, topSeries: summed };
    },
    [datasource]
  );

  const renderActions = useCallback(
    (label: string) => (
      <>
        {onShowLogs && (
          <Button size='sm' variant='secondary' icon='eye' onClick={() => onShowLogs(label)}>
            Show logs
          </Button>
        )}
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
    [field, onFilterClick, onShowLogs]
  );

  const renderExpandedRow = useCallback(
    (label: string, index: number) => (
      <ValueExpandedLogs datasource={datasource} query={query} field={field} value={label} range={range} index={index} />
    ),
    [datasource, query, field, range]
  );

  return (
    <BreakdownTable
      // a different field is a different table — remount so search/legend/page state never leaks
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
      transformVolume={transformVolume}
      chartFieldConfig={VALUES_CHART_FIELD_CONFIG}
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

/** Expanded-row content: the sample of logs with `field = value` */
const ValueExpandedLogs: React.FC<ValueExpandedLogsProps> = ({ datasource, query, field, value, range, index }) => {
  const [ref, width] = useElementWidth();
  const logsData = useValueLogsSample(datasource, query, field, value, range, true, index);
  const isLoading = logsData.state === LoadingState.Loading;
  const hasSeries = logsData.series.length > 0;

  return (
    <div ref={ref}>
      {isLoading && !hasSeries && <LoadingPlaceholder text='Loading logs...' />}
      {logsData.state === LoadingState.Error && (
        <Alert severity='error' title='Failed to load logs'>
          {logsData.errors?.[0]?.message}
        </Alert>
      )}
      {logsData.state === LoadingState.Done && !hasSeries && <NoDataPlaceholder height={EXPANDED_LOGS_HEIGHT} />}
      {width > 0 && hasSeries && (
        <PanelRenderer
          pluginId='logs'
          title={`${field}=${value} logs`}
          data={logsData}
          width={width}
          height={EXPANDED_LOGS_HEIGHT}
          options={{
            showTime: true,
            wrapLogMessage: false,
            enableLogDetails: false,
            dedupStrategy: 'none',
            sortOrder: 'Descending',
            fontSize: 'small',
          }}
        />
      )}
    </div>
  );
};
