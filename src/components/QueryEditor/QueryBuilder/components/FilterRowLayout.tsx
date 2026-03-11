import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

interface FilterRowLayoutProps {
  children: ReactNode;
  onDelete: () => void;
  canDelete?: boolean;
  disabledDeleteTooltip?: string;
  className?: string;
}

const FilterRowLayout = ({
  children,
  onDelete,
  canDelete = true,
  disabledDeleteTooltip,
  className,
}: FilterRowLayoutProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.wrapper, className)}>
      <Stack direction={'row'} gap={0.5} alignItems={'center'} justifyContent={'flex-start'}>
        {children}
        <div className={styles.actions}>
          <IconButton
            name={'times'}
            tooltip={canDelete ? 'Remove filter' : disabledDeleteTooltip ?? 'Cannot remove the filter'}
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

export default FilterRowLayout;
