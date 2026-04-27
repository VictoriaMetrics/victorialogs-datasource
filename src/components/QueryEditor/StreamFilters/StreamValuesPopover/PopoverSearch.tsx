import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Input, useStyles2 } from '@grafana/ui';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export const PopoverSearch: React.FC<Props> = ({ value, onChange }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.search}>
      <Input
        autoFocus
        placeholder='Search values'
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  search: css`
    padding: ${theme.spacing(0, 1, 0.75)};
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
});
