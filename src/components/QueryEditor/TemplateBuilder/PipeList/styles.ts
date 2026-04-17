import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  staticText: css({
    color: theme.colors.text.secondary,
    whiteSpace: 'pre',
  }),
  pipeSeparator: css({
    color: theme.colors.text.disabled,
    padding: theme.spacing(0, 0.25),
  }),
  insertSeparator: css({
    display: 'inline-flex',
    alignItems: 'center',
    ['&:hover .insert-btn']: {
      opacity: 1,
    },
  }),
  insertSeparatorButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
    marginLeft: theme.spacing(0.25),
    opacity: 0,
    transition: 'opacity 0.15s',
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
      opacity: 1,
    },
  }),
});
