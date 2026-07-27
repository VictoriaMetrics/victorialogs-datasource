import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, IconButton, PopoverContent, Tooltip, useStyles2 } from '@grafana/ui';

export interface ChipAction {
  icon: IconName;
  onClick: () => void;
  ariaLabel: string;
  tooltip?: PopoverContent;
}

interface Props {
  /** Prefix rendered in secondary color, including its separator (e.g. `app:` or `foo :=`) */
  label: string;
  /** Inner value pills, each with its own remove button */
  values: string[];
  /** Called with a specific value when its inner × is clicked */
  onRemoveValue: (value: string) => void;
  /** Called when the outer × is clicked to remove all values */
  onRemoveAll: () => void;
  /** Tooltip text on the whole chip. Falls back to `label: value1, value2, …` */
  title?: string;
  /** Tooltip for the outer remove-all button */
  removeAllTooltip?: string;
  /** aria-label generator for the per-value remove button */
  buildRemoveValueAriaLabel?: (label: string, value: string) => string;
  /** aria-label for the outer remove-all button */
  removeAllAriaLabel?: string;
  /** Rendered before the label (e.g. a stream badge or a warning icon) */
  leading?: ReactNode;
  /** Extra action buttons rendered before the remove-all cross in the same segment style */
  actions?: ChipAction[];
  /** Extra class for the chip container (e.g. an invalid-state variant) */
  className?: string;
}

export const GroupedChip: React.FC<Props> = ({
  label,
  values,
  onRemoveValue,
  onRemoveAll,
  title,
  removeAllTooltip,
  buildRemoveValueAriaLabel,
  removeAllAriaLabel,
  leading,
  actions,
  className,
}) => {
  const styles = useStyles2(getStyles);
  const tooltip = title ?? `${label} ${values.join(', ')}`;
  const resolvedRemoveAllAriaLabel = removeAllAriaLabel ?? `Remove all values of ${label}`;
  const resolvedRemoveAllTooltip = removeAllTooltip ?? resolvedRemoveAllAriaLabel;
  const resolveRemoveValueAriaLabel = (value: string): string =>
    buildRemoveValueAriaLabel
      ? buildRemoveValueAriaLabel(label, value)
      : `Remove ${label}: ${value}`;
  const showPerValueRemove = values.length > 1;

  return (
    <div className={cx(styles.chip, className)} title={tooltip}>
      {leading}
      <span className={styles.label}>{label}</span>
      <span className={styles.values}>
        {values.map((value) => (
          <span key={value} className={styles.valuePill} title={value}>
            <span className={styles.valueText}>{value}</span>
            {showPerValueRemove && (
              <IconButton
                className={styles.valueRemoveButton}
                name='times'
                size='sm'
                type='button'
                onClick={() => onRemoveValue(value)}
                aria-label={resolveRemoveValueAriaLabel(value)}
              />
            )}
          </span>
        ))}
      </span>
      <div className={styles.trailingActions}>
        {actions?.map((action) => {
          const button = (
            <button
              type='button'
              className={styles.actionButton}
              onClick={action.onClick}
              aria-label={action.ariaLabel}
            >
              <Icon name={action.icon} size='md' />
            </button>
          );
          return action.tooltip ? (
            <Tooltip key={action.ariaLabel} content={action.tooltip} placement='top'>
              {button}
            </Tooltip>
          ) : (
            <React.Fragment key={action.ariaLabel}>{button}</React.Fragment>
          );
        })}
        <button
          type='button'
          className={styles.actionButton}
          onClick={onRemoveAll}
          aria-label={resolvedRemoveAllAriaLabel}
          title={resolvedRemoveAllTooltip}
        >
          <Icon name='times' size='md' />
        </button>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    padding: ${theme.spacing(0.25, 0, 0.25, 1)};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.primary};
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.body.fontSize};

    &:hover {
      border-color: ${theme.colors.border.medium};
    }
  `,
  trailingActions: css({
    display: 'flex',
    alignSelf: 'stretch',
    margin: theme.spacing(-0.25, 0, -0.25, 'auto'),
  }),
  actionButton: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(0, 0.75),
    border: 'none',
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    background: 'transparent',
    color: theme.colors.text.secondary,
    cursor: 'pointer',

    '&:last-child': {
      borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
    },
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: '-2px',
    },
  }),
  label: css`
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
  `,
  values: css`
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.spacing(0.5)};
  `,
  valuePill: css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing(0.25)};
    padding: ${theme.spacing(0, 0.75)};
    min-height: ${theme.spacing(3)};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    color: ${theme.colors.text.primary};
  `,
  valueText: css`
    display: inline-block;
    max-width: ${theme.spacing(30)};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  `,
  valueRemoveButton: css`
    margin-left: ${theme.spacing(0.5)};
    margin-right: 0;
  `
});
