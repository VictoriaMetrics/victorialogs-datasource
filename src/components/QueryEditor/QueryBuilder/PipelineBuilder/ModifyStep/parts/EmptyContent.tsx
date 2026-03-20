import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface EmptyContentProps {
  row?: unknown;
  onChange?: unknown;
  datasource?: unknown;
  timeRange?: unknown;
  queryContext?: unknown;
}

const EmptyContent = memo<EmptyContentProps>(function EmptyContent() {
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
