import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

interface Props {
  /** Optional prefix rendered in secondary color (e.g. field name). */
  label?: string;
  /** Primary text — rendered with monospace font and truncated on overflow. */
  value: string;
  /** Tooltip text. Falls back to "label: value" (or just value) when omitted. */
  title?: string;
  /** When provided, renders a × button at the end. */
  onRemove?: () => void;
  removeAriaLabel?: string;
}

export const Chip: React.FC<Props> = ({ label, value, title, onRemove, removeAriaLabel }) => {
  const styles = useStyles2(getStyles);
  const tooltip = title ?? (label ? `${label}: ${value}` : value);
  return (
    <div className={styles.chip} title={tooltip}>
      <span className={styles.content}>
        {label && <span className={styles.label}>{label}:</span>}
        <span className={styles.value}>{value}</span>
      </span>
      {onRemove && (
        <IconButton
          name={'times'}
          size={'md'}
          type='button'
          onClick={onRemove}
          aria-label={removeAriaLabel ?? `Remove ${tooltip}`}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.primary};
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.body.fontSize};

    &:hover {
      border-color: ${theme.colors.border.medium};
    }
  `,
  content: css`
    padding: ${theme.spacing(0, 0, 0, 1)};
  `,
  label: css`
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
  `,
  value: css`
    display: inline-block;
    max-width: ${theme.spacing(30)};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
    color: ${theme.colors.text.primary};
  `,
});
