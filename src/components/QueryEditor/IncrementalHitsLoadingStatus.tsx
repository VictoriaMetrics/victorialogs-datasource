import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useObservable } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { getIncrementalHitsLoadingRuns } from '../../logsVolume/incrementalHitsLoadingRuns';

interface Props {
  datasourceUid: string;
  /** The Explore request of the pane; undefined before its first run */
  requestId: string | undefined;
}

/** Progress of the bar-by-bar logs volume loading of the pane with pause/resume and stop; rendered only while its job runs */
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
      <Stack direction='row' alignItems='center' gap={1}>
        <Text variant='bodySmall' color='secondary'>
          {`Logs volume: ${state.loadedBars} / ${state.totalBars} bars${paused ? ' (paused)' : ''}`}
        </Text>
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
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // keeps the hovered buttons clear of the query input above
  row: css({
    marginTop: theme.spacing(1),
  }),
});
