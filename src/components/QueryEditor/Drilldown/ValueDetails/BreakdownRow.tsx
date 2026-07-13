import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { AbsoluteTimeRange, FieldConfigSource, GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, LoadingPlaceholder, PanelContextProvider, Stack, useStyles2 } from '@grafana/ui';

import { NoDataPlaceholder } from '../shared/NoDataPlaceholder';
import { useElementWidth } from '../shared/useElementWidth';
import { getSeriesLabels, useLegendSeriesToggle } from '../shared/useLegendSeriesToggle';

const ROW_PANEL_HEIGHT = 200;

/** Default volume-chart field config for rows with no custom chart styling (value rows) — frames carry their own per-field configs, only the axis/tooltip unit is forced */
const DEFAULT_VOLUME_FIELD_CONFIG: FieldConfigSource = { defaults: { unit: 'short' }, overrides: [] };

interface BreakdownRowProps {
  /** Row header content, next to the actions */
  title: React.ReactNode;
  /** Caption for the volume chart panel; the logs panel reuses it as `${panelTitle} logs` */
  panelTitle: string;
  actions?: React.ReactNode;
  volumeData: PanelData;
  logsData: PanelData;
  inViewRef: React.RefCallback<HTMLElement>;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
  chartFieldConfig?: FieldConfigSource;
  /** Shows a per-series legend table (e.g. per-level totals) on the volume chart instead of hiding it */
  showChartLegend?: boolean;
}

const CHART_OPTIONS_WITH_LEGEND = {
  legend: { showLegend: true, displayMode: 'table', placement: 'right', calcs: ['sum'] },
  tooltip: { mode: 'multi' },
};
const CHART_OPTIONS_WITHOUT_LEGEND = { legend: { showLegend: false }, tooltip: { mode: 'multi' } };

/** Presentational breakdown row: header with title/actions, a volume chart next to a lazily loaded logs sample */
export const BreakdownRow: React.FC<BreakdownRowProps> = ({
  title,
  panelTitle,
  actions,
  volumeData,
  logsData,
  inViewRef,
  onChangeTimeRange,
  chartFieldConfig,
  showChartLegend,
}) => {
  const styles = useStyles2(getStyles);
  const [chartRef, chartWidth] = useElementWidth();
  const [logsRef, logsWidth] = useElementWidth();
  const logsLoading = logsData.state === LoadingState.Loading;
  const volumeHasSeries = volumeData.series.length > 0;
  const logsHasSeries = logsData.series.length > 0;

  // axis/tooltip/legend numbers must always render in Grafana's compact 'short' form (e.g. 12.3K);
  // when a custom chart config is given (patterns' bars styling) merge the unit in without dropping it
  const volumeFieldConfig = useMemo<FieldConfigSource>(
    () =>
      chartFieldConfig
        ? { ...chartFieldConfig, defaults: { ...chartFieldConfig.defaults, unit: 'short' } }
        : DEFAULT_VOLUME_FIELD_CONFIG,
    [chartFieldConfig]
  );

  // makes the legend (when shown) interactive: click isolates a series, ctrl/cmd+click appends
  const seriesLabels = useMemo(() => getSeriesLabels(volumeData), [volumeData]);
  const { panelContext, fieldConfig } = useLegendSeriesToggle(seriesLabels, volumeFieldConfig);

  return (
    <div ref={inViewRef} className={styles.row}>
      <Stack direction='row' justifyContent='space-between' alignItems='center'>
        <Stack direction='row' gap={1} alignItems='baseline'>
          {title}
        </Stack>
        {actions && <Stack direction='row' gap={0.5}>{actions}</Stack>}
      </Stack>
      <div className={styles.rowPanels}>
        <div ref={chartRef}>
          {chartWidth > 0 && volumeHasSeries && (
            <PanelContextProvider value={panelContext}>
              <PanelRenderer
                pluginId='timeseries'
                title={panelTitle}
                data={volumeData}
                width={chartWidth}
                height={ROW_PANEL_HEIGHT}
                options={showChartLegend ? CHART_OPTIONS_WITH_LEGEND : CHART_OPTIONS_WITHOUT_LEGEND}
                onChangeTimeRange={onChangeTimeRange}
                fieldConfig={fieldConfig}
              />
            </PanelContextProvider>
          )}
          {/* a completed refetch with no series must reserve the same height as the chart it
              replaces, otherwise the layout jumps (e.g. on zoom-in into a range with no data) */}
          {chartWidth > 0 && !volumeHasSeries && volumeData.state === LoadingState.Done && (
            <NoDataPlaceholder height={ROW_PANEL_HEIGHT} />
          )}
        </div>
        <div ref={logsRef}>
          {/* a refetch keeps the previous series in `logsData` while Loading — only show the
              placeholder when there is nothing to keep showing (first load / after an identity change) */}
          {logsLoading && !logsHasSeries && <LoadingPlaceholder text='Loading logs...' />}
          {logsData.state === LoadingState.Error && (
            <Alert severity='error' title='Failed to load logs'>
              {logsData.errors?.[0]?.message}
            </Alert>
          )}
          {/* same layout-stability guard as the volume chart above, for the logs sample */}
          {logsData.state === LoadingState.Done && !logsHasSeries && <NoDataPlaceholder height={ROW_PANEL_HEIGHT} />}
          {logsWidth > 0 && logsHasSeries && (
            <div className={logsLoading ? styles.refetching : undefined}>
              <PanelRenderer
                pluginId='logs'
                title={`${panelTitle} logs`}
                data={logsData}
                width={logsWidth}
                height={ROW_PANEL_HEIGHT}
                options={{
                  showTime: true,
                  wrapLogMessage: false,
                  enableLogDetails: false,
                  dedupStrategy: 'none',
                  sortOrder: 'Descending',
                  fontSize: 'small',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    padding: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  rowPanels: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 2fr) minmax(300px, 2fr)',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  }),
  // dims the logs panel while a refetch (identity unchanged) is in flight, without unmounting it
  refetching: css({
    opacity: 0.6,
    transition: 'opacity 0.2s',
  }),
});
