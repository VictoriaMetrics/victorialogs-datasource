import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  pipeSearchPanel: css({
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
    width: 260,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }),
  pipeSearchInputRow: css({
    padding: theme.spacing(0.75, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  pipeSearchInput: css({
    width: '100%',
    background: 'none',
    border: 'none',
    outline: 'none',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    '&::placeholder': {
      color: theme.colors.text.disabled,
    },
  }),
  pipeSearchList: css({
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(0.5, 0),
  }),
  pipeSearchGroupLabel: css({
    padding: theme.spacing(0.25, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontWeight: theme.typography.fontWeightMedium,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginTop: theme.spacing(0.5),
  }),
  pipeSearchItem: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(0.5, 1.5),
    cursor: 'pointer',
  }),
  pipeSearchItemHighlighted: css({
    backgroundColor: theme.colors.action.hover,
  }),
  pipeSearchItemLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
  }),
  pipeSearchItemDesc: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginTop: 1,
  }),
  pipeSearchEmpty: css({
    padding: theme.spacing(1, 1.5),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
  }),
});
