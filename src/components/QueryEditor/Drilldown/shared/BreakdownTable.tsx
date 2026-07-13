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

import { useElementWidth } from './useElementWidth';
import { useLegendSeriesToggle } from './useLegendSeriesToggle';

const TOP_CHART_HEIGHT = 200;
const SPARKLINE_WIDTH = 230;
const SPARKLINE_HEIGHT = 30;

/** Axis-less, legend-less mini chart for the volume column, like Grafana Logs Drilldown's patterns table */
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

/** One row of a breakdown table — a pattern or a field value */
export interface BreakdownTableItem {
  label: string;
  total: number;
  /** true when `total` is a sampled estimate — rendered as "~N" until the row's exact volume arrives */
  approx?: boolean;
}

interface BreakdownTableRowData {
  label: string;
  total: number;
  approx: boolean;
  index: number;
}

/** Sparkline + top-chart series derived from one row's raw volume frames */
export interface TransformedVolume {
  sparkline: PanelData;
  topSeries: DataFrame[];
}

/** Exact volume of one row, reported up by its sparkline cell */
interface LoadedRowVolume {
  raw: PanelData;
  topSeries: DataFrame[];
  total?: number;
}

interface BreakdownTableProps {
  items: BreakdownTableItem[];
  loading: boolean;
  error?: string;
  /** true when the list hit its cap — the real item count is understated */
  serverTruncated?: boolean;
  /** Plural noun for texts: "patterns", "values" */
  noun: string;
  searchPlaceholder: string;
  datasource: VictoriaLogsDatasource;
  range: TimeRange;
  /** Builds the hits query behind a row's sparkline; the refId must carry the suffix */
  buildVolumeQuery: (label: string, refIdSuffix: number) => Query;
  /** Derives the sparkline and the top-chart series from a row's raw frames; identity by default */
  transformVolume?: (frames: DataFrame[], range: TimeRange) => TransformedVolume;
  /** Base field config of the top chart; plain lines by default */
  chartFieldConfig?: FieldConfigSource;
  renderActions: (label: string) => React.ReactNode;
  renderExpandedRow: (label: string, index: number) => React.ReactNode;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/** Display name of a row in the chart/legend — an empty value must not fall back to the raw field name */
const toDisplayLabel = (label: string): string => label || '(empty)';

/** Names a row frame's series after the row itself instead of an empty label set */
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
 * Grafana Logs Drilldown-style breakdown view in two phases: a fast list renders
 * immediately; each visible row then loads its own single-series volume, driving the
 * sparkline, the exact count, and the shared top chart. The top chart's legend is
 * click-synced with the table (isolate / ctrl-append / reset)
 */
export const BreakdownTable: React.FC<BreakdownTableProps> = ({
  items,
  loading,
  error,
  serverTruncated,
  noun,
  searchPlaceholder,
  datasource,
  range,
  buildVolumeQuery,
  transformVolume,
  chartFieldConfig = TOP_CHART_FIELD_CONFIG,
  renderActions,
  renderExpandedRow,
  onChangeTimeRange,
}) => {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [chartRef, chartWidth] = useElementWidth();
  // exact volumes stream in from the visible rows' sparkline cells; mirrored into a ref so
  // the column definitions can read them without depending on the state identity — columns
  // must stay referentially stable, or InteractiveTable remounts every cell (restarting the
  // per-row volume queries) each time a volume lands
  const [volumes, setVolumes] = useState<Record<string, LoadedRowVolume>>({});
  const volumesRef = React.useRef(volumes);

  const onVolumeLoaded = useCallback((label: string, raw: PanelData, topSeries: DataFrame[], total?: number) => {
    // reference check keeps re-renders bounded — a cell reports once per completed fetch
    setVolumes((prev) => {
      if (prev[label]?.raw === raw) {
        return prev;
      }
      const next = { ...prev, [label]: { raw, topSeries, total } };
      volumesRef.current = next;
      return next;
    });
  }, []);

  // legend sync, as in Grafana Logs Drilldown: clicking a legend item narrows BOTH the chart
  // and the table to the selected rows (empty set = no narrowing). Chip filters untouched
  // legendSelected stores DISPLAY labels — the legend reports what it renders
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

  // the table narrows to the legend selection; the chart keeps every series (hidden ones are
  // greyed in the legend via hideFrom overrides) so a selection can always be undone
  const filtered = useMemo(
    () => (legendSelected.size ? searchFiltered.filter((i) => legendSelected.has(toDisplayLabel(i.label))) : searchFiltered),
    [searchFiltered, legendSelected]
  );

  // percentages are shares of everything currently loaded, not of the searched subset;
  // list totals keep every row on the same scale
  const totalHits = useMemo(() => items.reduce((acc, i) => acc + i.total, 0), [items]);

  const topChartData = useMemo(
    () => ({
      series: searchFiltered.flatMap((i) => {
        const loaded = volumes[i.label];
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
          // read through the ref — see the volumes/volumesRef comment above
          const exact = volumesRef.current[label]?.total;
          // "~" marks a sampled estimate; it disappears once the row's exact volume arrives
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
        header: 'Value',
        cell: (props: CellProps<BreakdownTableRowData>) => (
          <span className={styles.labelText}>{props.cell.row.original.label || '(empty)'}</span>
        ),
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
    // `volumes` deliberately excluded — cells read it through volumesRef (see above)
     
    [styles, range, datasource, totalHits, buildVolumeQuery, transformVolume, renderActions, onVolumeLoaded]
  );

  // no previous rows to keep showing — either the first load, or the list identity changed
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
          getRowId={(row: BreakdownTableRowData) => row.label}
          pageSize={BREAKDOWN_PAGE_SIZE}
          // a legend click or search from page 2+ must land on the first page of the narrowed
          // list — without this the page index survives the data change and shows emptiness.
          // Background volume loads don't touch tableData's identity, so they can't reset it
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
  transformVolume?: (frames: DataFrame[], range: TimeRange) => TransformedVolume;
  onLoaded: (label: string, raw: PanelData, topSeries: DataFrame[], total?: number) => void;
}

/**
 * Sparkline cell that owns the row's volume query. InteractiveTable renders only the
 * current page, so mounting this cell is what makes a row's volume load lazily.
 * The completed result is reported up for the top chart and the exact count
 */
const RowVolumeCell: React.FC<RowVolumeCellProps> = ({
  datasource,
  label,
  range,
  target,
  transformVolume,
  onLoaded,
}) => {
  const styles = useStyles2(getStyles);
  const { data, total } = useTargetVolume(datasource, target, range);

  // a stable key: `range` is often a fresh object with identical timestamps
  const rangeKey = `${range.from.valueOf()}-${range.to.valueOf()}`;
  // identity transform by default: raw frames feed both the sparkline and the top chart
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
  truncationNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  // dims the rows while a context-only refetch (range/filters/expr) is in flight, without unmounting them
  refetching: css({
    opacity: 0.6,
    transition: 'opacity 0.2s',
  }),
});
