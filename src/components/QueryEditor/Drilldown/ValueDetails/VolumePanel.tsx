import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { AbsoluteTimeRange, FieldConfigSource, LoadingState, PanelData } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, LoadingPlaceholder, PanelContextProvider, useStyles2 } from '@grafana/ui';

import { NoDataPlaceholder } from '../shared/NoDataPlaceholder';
import { useElementWidth } from '../shared/useElementWidth';
import { getSeriesLabels, useLegendSeriesToggle } from '../shared/useLegendSeriesToggle';

const VOLUME_PANEL_HEIGHT = 140;

/** Forces every number into Grafana's compact 'short' form, for example 12.3K */
const VOLUME_FIELD_CONFIG: FieldConfigSource = { defaults: { unit: 'short' }, overrides: [] };

interface VolumePanelProps {
  data: PanelData;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/** The current query's level-grouped hits volume, as a timeseries panel */
export const VolumePanel: React.FC<VolumePanelProps> = ({ data, onChangeTimeRange }) => {
  const [ref, width] = useElementWidth();
  const styles = useStyles2(getStyles);
  const isLoading = data.state === LoadingState.Loading;
  const hasSeries = data.series.length > 0;

  // makes the legend interactive: a click isolates a level, ctrl or cmd click adds one
  const seriesLabels = useMemo(() => getSeriesLabels(data), [data]);
  const { panelContext, fieldConfig } = useLegendSeriesToggle(seriesLabels, VOLUME_FIELD_CONFIG);

  return (
    <div ref={ref}>
      {data.state === LoadingState.Error && (
        <Alert severity='error' title='Failed to load log volume'>
          {data.errors?.[0]?.message}
        </Alert>
      )}
      {/* a refetch keeps the previous series in `data` while Loading — only show the placeholder
          when there is nothing to keep showing (first load / after an identity change) */}
      {isLoading && !hasSeries && <LoadingPlaceholder text='Loading log volume...' />}
      {/* a completed refetch with no series must reserve the same height as the panel it replaces,
          otherwise the layout jumps (e.g. on zoom-in into a range with no data) */}
      {data.state === LoadingState.Done && !hasSeries && <NoDataPlaceholder height={VOLUME_PANEL_HEIGHT} />}
      {width > 0 && hasSeries && (
        <div className={isLoading ? styles.refetching : undefined}>
          <PanelContextProvider value={panelContext}>
            <PanelRenderer
              pluginId='timeseries'
              title='Log volume'
              data={data}
              width={width}
              height={VOLUME_PANEL_HEIGHT}
              options={{
                // the per-level totals answer how many logs of each level the selection holds
                legend: { showLegend: true, displayMode: 'table', placement: 'right', calcs: ['sum'] },
                tooltip: { mode: 'multi' },
              }}
              onChangeTimeRange={onChangeTimeRange}
              fieldConfig={fieldConfig}
            />
          </PanelContextProvider>
        </div>
      )}
    </div>
  );
};

const getStyles = () => ({
  // dims the panel while a refetch runs, instead of unmounting it
  refetching: css({
    opacity: 0.6,
    transition: 'opacity 0.2s',
  }),
});
