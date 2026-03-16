import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Input, Stack, useStyles2 } from '@grafana/ui';

interface Props {
  customPipes: string[];
  onChange: (customPipes: string[]) => void;
}

const CustomPipesEditor = memo<Props>(({ customPipes, onChange }) => {
  const styles = useStyles2(getStyles);

  const handlePipeChange = useCallback(
    (index: number, value: string) => {
      const updated = [...customPipes];
      updated[index] = value;
      onChange(updated);
    },
    [customPipes, onChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      const updated = customPipes.filter((_, i) => i !== index);
      onChange(updated);
    },
    [customPipes, onChange]
  );

  return (
    <div className={styles.container}>
      <span className={styles.label}>Custom pipes</span>
      <Stack direction='column' gap={0.5}>
        {customPipes.map((pipe, index) => (
          <Stack key={index} direction='row' gap={0.5} alignItems='center'>
            <span className={styles.pipePrefix}>|</span>
            <Input
              className={styles.input}
              value={pipe}
              onChange={(e) => handlePipeChange(index, e.currentTarget.value)}
              placeholder='pipe expression'
            />
            <IconButton
              name='trash-alt'
              aria-label='Remove custom pipe'
              size='sm'
              onClick={() => handleDelete(index)}
            />
          </Stack>
        ))}
      </Stack>
    </div>
  );
});

CustomPipesEditor.displayName = 'CustomPipesEditor';

export default CustomPipesEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    margin-top: ${theme.spacing(1)};
    padding-top: ${theme.spacing(1)};
    border-top: 1px dashed ${theme.colors.border.weak};
  `,
  label: css`
    display: block;
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  pipePrefix: css`
    color: ${theme.colors.text.secondary};
    font-family: ${theme.typography.fontFamilyMonospace};
    font-weight: ${theme.typography.fontWeightBold};
    flex-shrink: 0;
  `,
  input: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
