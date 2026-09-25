import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';

export interface ConstantField {
  name: string;
  value: string;
}

interface ConstantFieldsStripProps {
  fields: ConstantField[];
}

/**
 * One-line strip of the fields that hold a single value across the whole selection. Such a
 * field needs no chart and no drill-in, because the chip already shows everything it has
 */
export const ConstantFieldsStrip: React.FC<ConstantFieldsStripProps> = ({ fields }) => {
  const styles = useStyles2(getStyles);

  if (!fields.length) {
    return null;
  }

  return (
    <Stack direction='column' gap={0.5}>
      <Text variant='bodySmall' color='secondary'>
        Constant fields (same value in every log of this selection)
      </Text>
      <Stack direction='row' gap={1} wrap='wrap'>
        {fields.map((field) => (
          <span key={field.name} className={styles.chip}>
            {`${field.name}=`}
            <span className={styles.value}>{field.value || '(empty)'}</span>
          </span>
        ))}
      </Stack>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  chip: css({
    padding: theme.spacing(0.25, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    overflowWrap: 'anywhere',
  }),
  // the value stands out from the field name, which is rendered in the secondary color
  value: css({
    color: theme.colors.text.primary,
  }),
});
