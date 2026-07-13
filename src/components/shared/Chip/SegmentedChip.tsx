import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props {
  /** Segment contents; each direct child renders as one segment behind a vertical divider */
  children: React.ReactNode;
  /** Tooltip text on the whole chip */
  title?: string;
  /** When provided, renders a × button as the trailing segment */
  onRemove?: () => void;
  removeAriaLabel?: string;
  /** Tooltip for the remove button; falls back to removeAriaLabel */
  removeTooltip?: string;
}

/**
 * Monolithic segmented chip: one rounded frame whose children render as segments
 * separated by vertical dividers (rounding only on the outer corners), with an
 * optional trailing remove button — the visual language of GroupedChip's outer shell
 */
export const SegmentedChip: React.FC<Props> = ({ children, title, onRemove, removeAriaLabel, removeTooltip }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.chip} title={title}>
      {children}
      {onRemove && (
        <button
          type='button'
          className={styles.remove}
          onClick={onRemove}
          aria-label={removeAriaLabel}
          title={removeTooltip ?? removeAriaLabel}
        >
          <Icon name='times' size='md' />
        </button>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  chip: css({
    display: 'inline-flex',
    alignItems: 'stretch',
    minHeight: 24,
    // never wider than the row — a shrinkable segment then ellipsizes instead of overflowing
    maxWidth: '100%',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.body.fontSize,
    // segment backgrounds (hover/active) must not poke out of the rounded outer corners
    overflow: 'hidden',
    '& > * + *': {
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    },
    '&:hover': {
      borderColor: theme.colors.border.medium,
    },
  }),
  remove: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: theme.spacing(0, 0.75),
    border: 'none',
    background: 'transparent',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: -2,
    },
  }),
});
