import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

interface StepRowLayoutProps {
  children: ReactNode;
  onDelete: () => void;
  canDelete?: boolean;
  disabledDeleteTooltip?: string;
  className?: string;
}

const StepRowLayout = ({
  children,
  onDelete,
  canDelete = true,
  disabledDeleteTooltip,
  className,
}: StepRowLayoutProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.wrapper, className)}>
      <Stack direction={'row'} gap={0.5} alignItems={'center'} justifyContent={'flex-start'}>
        {children}
        <div className={styles.actions}>
          <IconButton
            name={'times'}
            tooltip={canDelete ? 'Remove row' : disabledDeleteTooltip ?? 'Cannot remove the row'}
            size='sm'
            onClick={onDelete}
            disabled={!canDelete}
          />
        </div>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: grid;
    gap: ${theme.spacing(0.5)};
    width: max-content;
    border: 1px solid ${theme.colors.border.strong};
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)};
  `,
  actions: css`
    margin-left: ${theme.spacing(0.5)};
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
  `,
});

export default StepRowLayout;
