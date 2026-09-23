import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CellProps } from 'react-table';

import {
  AbsoluteTimeRange,
  DataFrame,
  FieldConfigSource,
  FieldType,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  TimeRange,
} from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import {
  Alert,
  EmptyState,
  Icon,
  InteractiveTable,
  Input,
  LoadingPlaceholder,
  PanelContextProvider,
  Stack,
  useStyles2,
} from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { formatHits } from '../../shared/formatHits';
import { BREAKDOWN_PAGE_SIZE } from '../queries/drilldownQueries';
import { useTargetVolume } from '../queries/useVolumeQueries';
import { useDrilldownTimeZone } from '../timeZoneContext';

import { useElementWidth } from './useElementWidth';
import { useLegendSeriesToggle } from './useLegendSeriesToggle';

const TOP_CHART_HEIGHT = 200;
const SPARKLINE_WIDTH = 230;
const SPARKLINE_HEIGHT = 30;

const SPARKLINE_FIELD_CONFIG: FieldConfigSource = {
  defaults: {
    custom: {
      axisPlacement: 'hidden',
      hideFrom: { legend: true, tooltip: true, viz: false },
      lineWidth: 1,
    },
  },
  overrides: [],
};

const TOP_CHART_FIELD_CONFIG: FieldConfigSource = { defaults: { unit: 'short' }, overrides: [] };

export interface BreakdownTableItem {
  label: string;
  total: number;
  /** `total` is a sampled estimate. The Count cell shows "~N" until the row's exact volume arrives */
  approx?: boolean;
}

interface BreakdownTableRowData {
  label: string;
  total: number;
  approx: boolean;
  index: number;
}

export interface TransformedVolume {
  sparkline: PanelData;
  topSeries: DataFrame[];
}

interface LoadedRowVolume {
  raw: PanelData;
  topSeries: DataFrame[];
  total?: number;
}

/** Per-row volumes the parent precomputed from one grouped hits query. RowVolumeCell decides when a row still needs its own query */
export interface ProvidedRowVolumes {
  byLabel: Map<string, { frames: DataFrame[]; total: number }>;
  state: LoadingState;
}

interface BreakdownTableProps {
  items: BreakdownTableItem[];
  loading: boolean;
  error?: string;
  /** The list hit its cap, so the real count is higher than `items.length` */
  serverTruncated?: boolean;
  /** Plural noun for the loading and empty texts: "patterns", "values" */
  noun: string;
  searchPlaceholder: string;
  labelHeader?: string;
  /** When set, labels render as clickable links */
  onLabelClick?: (label: string) => void;
  datasource: VictoriaLogsDatasource;
  range: TimeRange;
  /** Builds the hits query behind a row's sparkline. The refId must include `refIdSuffix` */
  buildVolumeQuery: (label: string, refIdSuffix: number) => Query;
  /** When set, rows take their volume from this shared result instead of querying per row */
  rowVolumes?: ProvidedRowVolumes;
  /** Derives the sparkline and the top-chart series from a row's raw frames. Identity by default */
  transformVolume?: (frames: DataFrame[], range: TimeRange) => TransformedVolume;
  chartFieldConfig?: FieldConfigSource;
  renderActions: (label: string) => React.ReactNode;
  renderExpandedRow: (label: string, index: number) => React.ReactNode;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/** Display name of a row. An empty value must not fall back to the raw field name */
const toDisplayLabel = (label: string): string => label || '(empty)';

/** Names a row's series after the row itself instead of an empty label set */
const withDisplayName = (frames: DataFrame[], name: string): DataFrame[] =>
  frames.map((frame) => ({
    ...frame,
    fields: frame.fields.map((field) =>
      field.type === FieldType.number
        ? { ...field, config: { ...field.config, displayNameFromDS: name } }
        : field
    ),
  }));

/**
 * Breakdown view in two phases. The list renders at once, then each visible row loads its
 * volume, which fills the sparkline, the exact count and the shared top chart. Clicking the
 * top chart's legend narrows the table to the same rows
 */
export const BreakdownTable: React.FC<BreakdownTableProps> = ({
  items,
  loading,
  error,
  serverTruncated,
  noun,
  searchPlaceholder,
  labelHeader = 'Value',
  onLabelClick,
  datasource,
  range,
  buildVolumeQuery,
  rowVolumes,
  transformVolume,
  chartFieldConfig = TOP_CHART_FIELD_CONFIG,
  renderActions,
  renderExpandedRow,
  onChangeTimeRange,
}) => {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [chartRef, chartWidth] = useElementWidth();
  const timeZone = useDrilldownTimeZone();
  // the visible rows' sparkline cells report their exact volumes here. The ref mirrors the
  // state so the column definitions can read a volume without listing it as a dependency:
  // any new column identity makes InteractiveTable remount every cell, which restarts the
  // per-row volume queries. A Map, because row labels are arbitrary field values and a plain
  // object would resolve names like `constructor` to Object.prototype members
  const [volumes, setVolumes] = useState<Map<string, LoadedRowVolume>>(() => new Map());
  const volumesRef = React.useRef(volumes);

  const onVolumeLoaded = useCallback((label: string, raw: PanelData, topSeries: DataFrame[], total?: number) => {
    setVolumes((prev) => {
      if (prev.get(label)?.raw === raw) {
        return prev;
      }
      const next = new Map(prev).set(label, { raw, topSeries, total });
      volumesRef.current = next;
      return next;
    });
  }, []);

  // `legendSelected` holds display labels, because the legend reports what it renders.
  // An empty set means no narrowing
  const allLabels = useMemo(() => items.map((i) => toDisplayLabel(i.label)), [items]);
  const {
    selected: legendSelected,
    panelContext,
    fieldConfig: topChartFieldConfig,
  } = useLegendSeriesToggle(allLabels, chartFieldConfig);

  const searchFiltered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? items.filter((i) => i.label.toLowerCase().includes(needle)) : items;
  }, [items, search]);

  // only the table narrows to the legend selection. The chart keeps every series, greyed out
  // in the legend, so the user can always undo a selection
  const filtered = useMemo(
    () => (legendSelected.size ? searchFiltered.filter((i) => legendSelected.has(toDisplayLabel(i.label))) : searchFiltered),
    [searchFiltered, legendSelected]
  );

  // the percentages are shares of every loaded row, not of the searched subset, so that a
  // search does not rescale them
  const totalHits = useMemo(() => items.reduce((acc, i) => acc + i.total, 0), [items]);

  const topChartData = useMemo(
    () => ({
      series: searchFiltered.flatMap((i) => {
        const loaded = volumes.get(i.label);
        return loaded ? withDisplayName(loaded.topSeries, toDisplayLabel(i.label)) : [];
      }),
      state: LoadingState.Done,
      timeRange: range,
    }),
    [searchFiltered, volumes, range]
  );

  const tableData = useMemo<BreakdownTableRowData[]>(
    () => filtered.map((i, index) => ({ label: i.label, total: i.total, approx: !!i.approx, index })),
    [filtered]
  );

  const columns = useMemo(
    () => [
      {
        id: 'volume',
        header: '',
        cell: (props: CellProps<BreakdownTableRowData>) => (
          <RowVolumeCell
            datasource={datasource}
            label={props.cell.row.original.label}
            range={range}
            target={buildVolumeQuery(props.cell.row.original.label, props.cell.row.original.index)}
            rowVolumes={rowVolumes}
            transformVolume={transformVolume}
            onLoaded={onVolumeLoaded}
          />
        ),
      },
      {
        id: 'count',
        header: 'Count',
        sortType: 'number' as const,
        disableGrow: true,
        cell: (props: CellProps<BreakdownTableRowData>) => {
          const { label, total, approx } = props.cell.row.original;
          // read through the ref, see the `volumes` comment above
          const exact = volumesRef.current.get(label)?.total;
          const text = !approx ? formatHits(total) : exact !== undefined ? formatHits(exact) : `~${formatHits(total)}`;
          return <span className={styles.countText}>{text}</span>;
        },
      },
      {
        id: 'percent',
        header: '%',
        sortType: 'number' as const,
        disableGrow: true,
        cell: (props: CellProps<BreakdownTableRowData>) => (
          <span className={styles.countText}>
            {totalHits > 0 ? `${((100 * props.cell.row.original.total) / totalHits).toFixed(0)}%` : '-'}
          </span>
        ),
      },
      {
        id: 'label',
        header: labelHeader,
        cell: (props: CellProps<BreakdownTableRowData>) => {
          const { label } = props.cell.row.original;
          return onLabelClick ? (
            <button type='button' className={styles.labelButton} onClick={() => onLabelClick(label)}>
              {toDisplayLabel(label)}
            </button>
          ) : (
            <span className={styles.labelText}>{toDisplayLabel(label)}</span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: (props: CellProps<BreakdownTableRowData>) => (
          <Stack direction='row' gap={0.5}>
            {renderActions(props.cell.row.original.label)}
          </Stack>
        ),
      },
    ],
    // `volumes` is left out on purpose. The cells read it through `volumesRef`
    [styles, range, datasource, totalHits, buildVolumeQuery, rowVolumes, transformVolume, renderActions, onVolumeLoaded, labelHeader, onLabelClick]
  );

  // a refetch keeps the previous rows on screen, so only the first load shows a placeholder
  if (loading && !items.length) {
    return <LoadingPlaceholder text={`Loading ${noun}...`} />;
  }

  if (error) {
    return (
      <Alert severity='error' title={`Failed to load ${noun}`}>
        {error}
      </Alert>
    );
  }

  if (!loading && !items.length) {
    return <EmptyState variant='not-found' message={`No ${noun} for the selected time range`} />;
  }

  return (
    <div className={loading ? styles.refetching : undefined}>
      <Stack direction='column' gap={1}>
        <Input
          prefix={<Icon name='search' />}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          aria-label={searchPlaceholder}
        />
        <div ref={chartRef}>
          {chartWidth > 0 && topChartData.series.length > 0 && (
            <PanelContextProvider value={panelContext}>
              <PanelRenderer
                pluginId='timeseries'
                title='Volume'
                data={topChartData}
                width={chartWidth}
                height={TOP_CHART_HEIGHT}
                timeZone={timeZone}
                options={{
                  legend: { showLegend: true, displayMode: 'list', placement: 'right' },
                  tooltip: { mode: 'single' },
                }}
                onChangeTimeRange={onChangeTimeRange}
                fieldConfig={topChartFieldConfig}
              />
            </PanelContextProvider>
          )}
          {chartWidth > 0 && topChartData.series.length === 0 && <LoadingPlaceholder text='Loading volumes...' />}
        </div>
        <InteractiveTable
          columns={columns}
          data={tableData}
          // react-table keys its rows in a plain object, so a bare label such as `constructor`
          // would resolve to an Object.prototype member. The prefix keeps every id an own key
          getRowId={(row: BreakdownTableRowData) => `row:${row.label}`}
          pageSize={BREAKDOWN_PAGE_SIZE}
          // a legend click or a search from page 2 must land on the first page of the narrowed
          // list, otherwise the old page index survives and the table looks empty. Background
          // volume loads do not change `tableData`, so they never trigger the reset
          autoResetPage
          renderExpandedRow={(row) => renderExpandedRow(row.label, row.index)}
        />
        {serverTruncated && (
          <span className={styles.truncationNote}>{`Loaded ${items.length} of ${items.length}+ ${noun}`}</span>
        )}
      </Stack>
    </div>
  );
};

interface RowVolumeCellProps {
  datasource: VictoriaLogsDatasource;
  label: string;
  range: TimeRange;
  target: Query;
  rowVolumes?: ProvidedRowVolumes;
  transformVolume?: (frames: DataFrame[], range: TimeRange) => TransformedVolume;
  onLoaded: (label: string, raw: PanelData, topSeries: DataFrame[], total?: number) => void;
}

/**
 * Sparkline cell behind a row's volume. With `rowVolumes` the cell renders from the shared
 * grouped result, and runs its own query only for a row that result does not cover (a deep
 * page, tuple truncation, or a failed grouped query). Without `rowVolumes` the cell always
 * owns the query, and because InteractiveTable renders only the current page, mounting the
 * cell is what loads the row lazily. The cell reports the finished result up for the top
 * chart and the exact count
 */
const RowVolumeCell: React.FC<RowVolumeCellProps> = ({
  datasource,
  label,
  range,
  target,
  rowVolumes,
  transformVolume,
  onLoaded,
}) => {
  const styles = useStyles2(getStyles);
  const timeZone = useDrilldownTimeZone();
  const provided = rowVolumes?.byLabel.get(label);
  const groupedSettled = rowVolumes?.state === LoadingState.Done || rowVolumes?.state === LoadingState.Error;
  const needsOwnQuery = !rowVolumes || (groupedSettled && !provided);
  const { data: ownData, total: ownTotal } = useTargetVolume(datasource, target, range, needsOwnQuery);

  // `range` is often a fresh object holding the same timestamps, so the memos below key off
  // this string instead
  const rangeKey = `${range.from.valueOf()}-${range.to.valueOf()}`;
  // memoized so that a volume coming from the shared source does not make the onLoaded effect
  // report a new object on every render
  const data = useMemo<PanelData>(
    () =>
      provided
        ? { series: provided.frames, state: LoadingState.Done, timeRange: range }
        : needsOwnQuery
          ? ownData
          : { series: [], state: LoadingState.Loading, timeRange: range },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provided, needsOwnQuery, ownData, rangeKey]
  );
  const total = provided ? provided.total : ownTotal;
  const transformed = useMemo<TransformedVolume>(
    () =>
      data.state === LoadingState.Done && transformVolume
        ? transformVolume(data.series, range)
        : { sparkline: data, topSeries: data.series },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, transformVolume, rangeKey]
  );

  useEffect(() => {
    if (data.state === LoadingState.Done) {
      onLoaded(label, data, transformed.topSeries, total);
    }
  }, [data, transformed, total, label, onLoaded]);

  return (
    <div className={styles.sparklineWrap}>
      {data.state === LoadingState.Done && transformed.sparkline.series.length > 0 ? (
        <PanelRenderer
          pluginId='timeseries'
          title={label}
          data={transformed.sparkline}
          width={SPARKLINE_WIDTH}
          height={SPARKLINE_HEIGHT}
          timeZone={timeZone}
          options={{ legend: { showLegend: false }, tooltip: { mode: 'none' } }}
          fieldConfig={SPARKLINE_FIELD_CONFIG}
        />
      ) : data.state === LoadingState.Error ? (
        <Icon name='exclamation-triangle' aria-label='Failed to load volume' />
      ) : (
        <div className={styles.sparklineLoading} aria-label='Loading volume' />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  sparklineWrap: css({
    pointerEvents: 'none',
    width: `${SPARKLINE_WIDTH}px`,
    height: `${SPARKLINE_HEIGHT}px`,
    overflow: 'hidden',
  }),
  sparklineLoading: css({
    width: '100%',
    height: '100%',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
  }),
  countText: css({
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  }),
  labelText: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  }),
  labelButton: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    background: 'none',
    border: 'none',
    padding: 0,
    textAlign: 'left',
    color: theme.colors.text.link,
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  truncationNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  // dims the rows while a refetch runs, instead of unmounting them
  refetching: css({
    opacity: 0.6,
    transition: 'opacity 0.2s',
  }),
});
