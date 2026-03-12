import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const EmptyContent = memo(function EmptyContent() {
  const styles = useStyles2(getStyles);
  return <span className={styles.text}>No parameters required</span>;
});

export default EmptyContent;

const getStyles = (theme: GrafanaTheme2) => ({
  text: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-style: italic;
  `,
});
