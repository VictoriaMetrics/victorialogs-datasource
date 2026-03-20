import { css } from '@emotion/css';
import React, { memo, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { getSharedStyles } from './styles';

interface OptionalFieldProps {
  label: string;
  isActive: boolean;
  onAdd: () => void;
  onRemove: () => void;
  children: ReactNode;
}

const OptionalField = memo(function OptionalField({ label, isActive, onAdd, onRemove, children }: OptionalFieldProps) {
  const shared = useStyles2(getSharedStyles);
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
      <div className={shared.removeButtonContainer}>
        <IconButton className={shared.removeButton} name='times' size='sm' tooltip={`Remove ${label}`} onClick={onRemove} />
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
});
