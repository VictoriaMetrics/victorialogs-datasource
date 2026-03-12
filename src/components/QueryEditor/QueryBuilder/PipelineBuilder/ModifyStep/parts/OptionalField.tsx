import { css } from '@emotion/css';
import React, { memo, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, IconButton, Stack, useStyles2 } from '@grafana/ui';

interface OptionalFieldProps {
  label: string;
  isActive: boolean;
  onAdd: () => void;
  onRemove: () => void;
  children: ReactNode;
}

const OptionalField = memo(function OptionalField({ label, isActive, onAdd, onRemove, children }: OptionalFieldProps) {
  const styles = useStyles2(getStyles);

  if (!isActive) {
    return (
      <Button variant='secondary' size='sm' icon='plus' onClick={onAdd} className={styles.addButton}>
        {label}
      </Button>
    );
  }

  return (
    <Stack direction='row' gap={0} alignItems='center'>
      <div className={styles.children}>
        {children}
      </div>
      <div className={styles.removeButtonContainer}>
        <IconButton className={styles.removeButton} name='times' size='sm' tooltip={`Remove ${label}`} onClick={onRemove} />
      </div>
    </Stack>
  );
});

export default OptionalField;

const getStyles = (theme: GrafanaTheme2) => ({
  addButton: css`
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
  `,
  children: css`
    & :last-child {
     & * {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
     }
    }
  `,
  removeButtonContainer: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    width: 23px;
    border: 1px solid ${theme.colors.border.medium};
    border-left: none;
    border-radius: 0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0;
  `,
  removeButton: css`
    margin: 0;
    width: 100%;
    height: 100%;
    &::before {
      width: 100%;
      height: 100%;
      border-radius: 0;
    }
  `
});
