import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

import { NoDataPlaceholder } from './NoDataPlaceholder';
import { useElementWidth } from './useElementWidth';

export const EXPANDED_LOGS_HEIGHT = 260;

interface ExpandedLogsPanelProps {
  data: PanelData;
  title: string;
}

/** Expanded-row content of a breakdown table: the row's sample of logs */
export const ExpandedLogsPanel: React.FC<ExpandedLogsPanelProps> = ({ data, title }) => {
  const [ref, width] = useElementWidth();
  const isLoading = data.state === LoadingState.Loading;
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
