import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ComboboxOption, useStyles2 } from '@grafana/ui';

interface Props {
  options: ComboboxOption[] | null;
  error: string | null;
  selectedValues: string[];
  onToggle: (value: string) => void;
}

export const ValuesList: React.FC<Props> = ({ options, error, selectedValues, onToggle }) => {
  const styles = useStyles2(getStyles);

  if (error) {
    return (
      <div className={styles.list}>
        <MessageRow text={`Failed to load values: ${error}`} />
      </div>
    );
  }

  if (options === null) {
    return (
      <div className={styles.list}>
        <MessageRow text='Loading…' />
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className={styles.list}>
        <MessageRow text='No matches' />
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {options.map((opt, i) => {
        if (opt.infoOption) {
          return <InfoRow key={`info-${i}`} label={opt.label} description={opt.description} />;
        }
        const value = opt.value || '';
        if (!value) {
          return null;
        }
        return (
          <ValueRow
            key={value}
            value={value}
            description={opt.description}
            checked={selectedValues.includes(value)}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
};

const MessageRow: React.FC<{ text: string }> = ({ text }) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.message}>{text}</div>;
};

const InfoRow: React.FC<{ label?: string; description?: string }> = ({ label, description }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.infoRow} title={description}>
      {label}
    </div>
  );
};

const ValueRow: React.FC<{
  value: string;
  description?: string;
  checked: boolean;
  onToggle: (value: string) => void;
}> = ({ value, description, checked, onToggle }) => {
  const styles = useStyles2(getStyles);
  return (
    <label className={styles.row}>
      <input type='checkbox' checked={checked} onChange={() => onToggle(value)} />
      <span className={styles.value}>{value}</span>
      {description && <span className={styles.meta}>{description}</span>}
    </label>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css`
    overflow-y: auto;
    padding: ${theme.spacing(0.5, 0)};
    flex: 1 1 auto;
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.75)};
    padding: ${theme.spacing(0.5, 1)};
    cursor: pointer;
    font-size: ${theme.typography.bodySmall.fontSize};

    &:hover {
      background: ${theme.colors.action.hover};
    }
  `,
  value: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    color: ${theme.colors.text.primary};
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  meta: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.xs};
    white-space: nowrap;
  `,
  infoRow: css`
    padding: ${theme.spacing(0.5, 1)};
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.xs};
    font-style: italic;
  `,
  message: css`
    padding: ${theme.spacing(0.75, 1)};
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
