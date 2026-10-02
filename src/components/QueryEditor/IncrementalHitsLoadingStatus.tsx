import { css } from '@emotion/css';
import React from 'react';
import { useObservable } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { IncrementalHitsLoadingController } from '../../logsVolume/IncrementalHitsLoadingController';

interface Props {
  controller: IncrementalHitsLoadingController;
}

/** Progress of the bar-by-bar logs volume loading with pause/resume and stop; rendered only while a job runs */
export const IncrementalHitsLoadingStatus = ({ controller }: Props) => {
  const styles = useStyles2(getStyles);
  const state = useObservable(controller.state$, controller.state);

  if (state.status === 'idle') {
    return null;
  }

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
  row: css({
    marginTop: theme.spacing(1),
  }),
});
