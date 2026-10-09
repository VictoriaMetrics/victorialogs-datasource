import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useObservable } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { IncrementalHitsLoadingState } from '../../logsVolume/IncrementalHitsLoadingController';
import { getIncrementalHitsLoadingRuns } from '../../logsVolume/incrementalHitsLoadingRuns';
import { INCREMENTAL_HITS_TIMEOUT_MS } from '../../logsVolume/logsGate';
import { SECOND_MS } from '../../utils/time/constants';

interface Props {
  datasourceUid: string;
  /** The Explore request of the pane; undefined before its first run */
  requestId: string | undefined;
}

/** Warning about the bar-by-bar logs volume loading of the pane with its progress, pause/resume and stop; rendered only while its job runs */
export const IncrementalHitsLoadingStatus = ({ datasourceUid, requestId }: Props) => {
  const styles = useStyles2(getStyles);
  const job$ = useMemo(() => getIncrementalHitsLoadingRuns(datasourceUid).job$(requestId), [datasourceUid, requestId]);
  const job = useObservable(job$);

  if (!job) {
    return null;
  }

  const { controller, state } = job;
  const paused = state.status === 'paused';

  return (
    <div className={styles.row}>
      <Alert severity='warning' title={getTitle(state)} bottomSpacing={0}>
        <Stack direction='column' gap={1}>
          <Text variant='bodySmall'>{getExplanation(state)}</Text>
          <Stack direction='row' alignItems='center' gap={1}>
            <Button
              size='sm'
              variant='secondary'
              fill='outline'
              icon={paused ? 'play' : 'pause'}
              onClick={() => (paused ? controller.resume() : controller.pause())}
            >
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button size='sm' variant='secondary' fill='outline' icon='square-shape' onClick={() => controller.stop()}>
              Stop
            </Button>
          </Stack>
        </Stack>
      </Alert>
    </div>
  );
};

const getTitle = (state: IncrementalHitsLoadingState): string =>
  `Logs volume is loading incrementally: ${state.loadedBars} / ${state.totalBars} bars${state.status === 'paused' ? ' (paused)' : ''}`;

const getExplanation = (state: IncrementalHitsLoadingState): string =>
  `The request couldn't finish within ${INCREMENTAL_HITS_TIMEOUT_MS / SECOND_MS} s, so the logs volume is loaded bar by bar with step=${state.step}. ` +
  'Select a range on the Logs volume chart to cancel it and drill down into a specific time range. ' +
  'Switch off "Incremental hits loading" in Query options to load everything in one request.';

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    marginTop: theme.spacing(1),
  }),
});
