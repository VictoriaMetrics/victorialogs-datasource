import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useObservable } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { IncrementalHitsLoadingState, LogsProgress } from '../../logsVolume/IncrementalHitsLoadingController';
import { getIncrementalHitsLoadingRuns } from '../../logsVolume/incrementalHitsLoadingRuns';
import { INCREMENTAL_HITS_TIMEOUT_MS } from '../../logsVolume/logsGate';
import { SECOND_MS } from '../../utils/time/constants';

interface Props {
  datasourceUid: string;
  /** The Explore request of the pane; undefined before its first run */
  requestId: string | undefined;
}

/** Warning about the bar-by-bar loading of the pane with the progress of its bars and logs, pause/resume and stop; rendered only while its job runs */
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
          {state.logsAfterBars && (
            <Stack direction='row' alignItems='center' gap={0.5}>
              <Icon name='info-circle' />
              <Text weight='medium'>{LOGS_AFTER_BARS_NOTE}</Text>
            </Stack>
          )}
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

const getTitle = ({ loadedBars, totalBars, logs, status }: IncrementalHitsLoadingState): string => {
  const progress = [`${loadedBars} / ${totalBars} bars`, ...logs.map(formatLogs)].join(', ');
  return `Logs volume is loading incrementally: ${progress}${status === 'paused' ? ' (paused)' : ''}`;
};

/** `350 logs (limit 1000)`, with the refId in front when the pane has several queries */
const formatLogs = ({ refId, loaded, limit }: LogsProgress, _index: number, logs: LogsProgress[]): string =>
  `${logs.length > 1 ? `${refId}: ` : ''}${loaded} logs (limit ${limit})`;

const LOGS_AFTER_BARS_NOTE = 'The query has pipes, so its logs are loaded once for the whole range after the last bar';

const getExplanation = ({ step, logsAfterBars }: IncrementalHitsLoadingState): string =>
  `VictoriaLogs didn't start answering within ${INCREMENTAL_HITS_TIMEOUT_MS / SECOND_MS} s, so the ${logsAfterBars ? 'logs volume is' : 'results are'} loaded bar by bar with step=${step}, in the logs sort order. ` +
  'Select a range on the Logs volume chart to cancel it and drill down into a specific time range. ' +
  'Switch off "Incremental hits loading" in Query options to load everything in one request.';

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    marginTop: theme.spacing(1),
  }),
});
