import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

import { useDrilldownTimeZone } from '../timeZoneContext';

import { NoDataPlaceholder } from './NoDataPlaceholder';
import { useElementWidth } from './useElementWidth';

export const EXPANDED_LOGS_HEIGHT = 260;

/** Logs-panel options shared by every logs view in the drilldown. `enableLogDetails` is the only one that varies */
export const LOGS_PANEL_OPTIONS = {
  showTime: true,
  wrapLogMessage: false,
  enableLogDetails: false,
  dedupStrategy: 'none',
  sortOrder: 'Descending',
  fontSize: 'small',
} as const;

interface ExpandedLogsPanelProps {
  data: PanelData;
  title: string;
}

export const ExpandedLogsPanel: React.FC<ExpandedLogsPanelProps> = ({ data, title }) => {
  const [ref, width] = useElementWidth();
  const timeZone = useDrilldownTimeZone();
  // a queued request has not started yet, but it is on its way, so it reads as loading too
  const isLoading = data.state === LoadingState.Loading || data.state === LoadingState.NotStarted;
  const hasSeries = data.series.length > 0;

  return (
    <div ref={ref}>
      {isLoading && !hasSeries && <LoadingPlaceholder text='Loading logs...' />}
      {data.state === LoadingState.Error && (
        <Alert severity='error' title='Failed to load logs'>
          {data.errors?.[0]?.message}
        </Alert>
      )}
      {data.state === LoadingState.Done && !hasSeries && <NoDataPlaceholder height={EXPANDED_LOGS_HEIGHT} />}
      {width > 0 && hasSeries && (
        <PanelRenderer
          pluginId='logs'
          title={title}
          data={data}
          width={width}
          height={EXPANDED_LOGS_HEIGHT}
          timeZone={timeZone}
          options={LOGS_PANEL_OPTIONS}
        />
      )}
    </div>
  );
};
