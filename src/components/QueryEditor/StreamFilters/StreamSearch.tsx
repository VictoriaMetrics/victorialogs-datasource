import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const StreamSearch: React.FC<Props> = ({ value, onChange, placeholder = 'Search' }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <Icon name='search' className={styles.icon} />
      <input
        autoFocus
        type='search'
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.75)};
    padding: ${theme.spacing(0.75, 1)};
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  icon: css`
    color: ${theme.colors.text.secondary};
    flex: 0 0 auto;
  `,
  input: css`
    flex: 1 1 auto;
    border: none;
    outline: none;
    background: transparent;
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.body.fontSize};
    min-width: 0;

    &::placeholder {
      color: ${theme.colors.text.secondary};
    }

    &::-webkit-search-cancel-button {
      cursor: pointer;
    }
  `,
});
