import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';

const STREAM_BADGE_TOOLTIP =
  'Stream field: the filter is applied as an indexed LogsQL stream filter — the fastest filter type in VictoriaLogs';

/** `{}` badge marking a filter that is applied as a LogsQL stream filter */
export const StreamBadge: React.FC = () => {
  const styles = useStyles2(getStyles);
  return (
    <Tooltip content={STREAM_BADGE_TOOLTIP} placement='top'>
      <span className={styles.streamBadge} aria-label='Stream filter' tabIndex={0}>
        {'{}'}
      </span>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  streamBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: theme.spacing(0, 0.5),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.primary.text,
    backgroundColor: theme.colors.primary.transparent,
    fontWeight: theme.typography.fontWeightBold,
    cursor: 'default',
    '&:hover, &:focus-visible': {
      color: theme.colors.primary.contrastText,
      backgroundColor: theme.colors.primary.main,
    },
  }),
});
