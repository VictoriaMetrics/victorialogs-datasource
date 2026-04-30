import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  staticText: css({
    color: theme.colors.text.secondary,
    whiteSpace: 'pre',
  }),
  pipeGroup: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
  }),
  deleteButton: css({
    opacity: 0,
    transition: 'opacity 0.15s',
    '.pipe-group:hover &': {
      opacity: 1,
    },
  }),
});
