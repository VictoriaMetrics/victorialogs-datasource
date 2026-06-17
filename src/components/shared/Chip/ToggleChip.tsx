import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2, type PopoverContent } from '@grafana/ui';

export type ToggleChipSize = 'sm' | 'md';

interface Props {
  /** Whether the chip is currently toggled on */
  active: boolean;
  onToggle: () => void;
  /** Chip content, e.g. `key="value"` */
  children: React.ReactNode;
  /** Default `sm` */
  size?: ToggleChipSize;
  disabled?: boolean;
  className?: string;
  /** Tooltip shown on hover */
  tooltip?: PopoverContent;
}

/**
 * Compact toggleable chip-button
 */
export const ToggleChip: React.FC<Props> = ({ active, onToggle, children, size = 'sm', disabled, className, tooltip }) => {
  const styles = useStyles2(getStyles);
  const chip = (
    <button
      type='button'
      aria-pressed={active}
      disabled={disabled}
      className={cx(styles.chip, styles[size], active && styles.active, className)}
      onClick={onToggle}
    >
      {children}
    </button>
  );

  if (!tooltip) {
    return chip;
  }

  return (
    <Tooltip content={tooltip} placement='top'>
      {chip}
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  chip: css({
    border: 'none',
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    backgroundColor: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    '&:hover': {
      color: theme.colors.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: '-2px',
    },
    '&:disabled': {
      cursor: 'not-allowed',
    },
  }),
  sm: css({
    padding: theme.spacing(0.25, 0.75),
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
  }),
  md: css({
    padding: theme.spacing(0.5, 1),
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  }),
  active: css({
    backgroundColor: theme.colors.primary.transparent,
    color: theme.colors.primary.text,
    '&:hover': {
      color: theme.colors.primary.text,
      backgroundColor: theme.colors.emphasize(theme.colors.primary.transparent, 0.1),
    },
  }),
});
