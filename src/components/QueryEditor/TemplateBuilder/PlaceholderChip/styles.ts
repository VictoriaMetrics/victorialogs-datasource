import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  placeholderEmpty: css({
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0, 0.5),
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
    cursor: 'pointer',
    minHeight: 22,
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  placeholderFilled: css({
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: theme.colors.action.selected,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0, 0.5),
    color: theme.colors.text.primary,
    cursor: 'pointer',
    minHeight: 22,
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  placeholderActive: css({
    outline: `2px solid ${theme.colors.primary.main}`,
    outlineOffset: 1,
  }),
  chipInput: css({
    background: 'none',
    border: 'none',
    outline: 'none',
    padding: 0,
    margin: 0,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: theme.colors.text.primary,
    minWidth: 20,
    width: 'auto',
  }),
  multiSelectedValues: css({
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
  }),
  optionsList: css({
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
    maxHeight: 240,
    overflowY: 'auto',
    minWidth: 160,
  }),
  optionItem: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(0.5, 1),
    cursor: 'pointer',
  }),
  optionItemHighlighted: css({
    backgroundColor: theme.colors.action.hover,
  }),
  optionLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  optionDescription: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginTop: 1,
  }),
  optionGroup: css({
    '& + &': {
      borderTop: `1px solid ${theme.colors.border.strong}`,
      marginTop: theme.spacing(1),
    },
  }),
  optionGroupLabel: css({
    padding: theme.spacing(0.5, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    backgroundColor: theme.colors.background.secondary,
  }),
});
