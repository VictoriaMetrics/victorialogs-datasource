import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface OperatorComponentProps {
  value: string;
  onChange: (value: string) => void;
}

const StaticOperatorLabel = memo<OperatorComponentProps>(({ value }) => {
  const styles = useStyles2(getStyles);

  return <span className={styles.label}>{value}</span>;
});

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    display: inline-flex;
    align-items: center;
    padding: 0 ${theme.spacing(0.5)};
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.text.primary};
    white-space: nowrap;
  `,
});

StaticOperatorLabel.displayName = 'StaticOperatorLabel';

export default StaticOperatorLabel;
