import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getChipSegmentStyles = (theme: GrafanaTheme2) => ({
  segmentSecondary: css({
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    padding: theme.spacing(0, 1),
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  segmentValue: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    padding: theme.spacing(0, 1),
    color: theme.colors.text.primary,
  }),
  segmentText: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  segmentButton: css({
    border: 'none',
    background: 'transparent',
    font: 'inherit',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: -2,
    },
  }),
});
