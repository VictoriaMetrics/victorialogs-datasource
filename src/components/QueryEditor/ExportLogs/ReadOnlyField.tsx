import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, useStyles2 } from '@grafana/ui';

interface Props {
  label: string;
  value: string;
}

export const ReadOnlyField: React.FC<Props> = ({ label, value }) => {
  const styles = useStyles2(getStyles);
  return (
    <Field label={label}>
      <div className={styles.value}>{value}</div>
    </Field>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  value: css({
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  }),
});
