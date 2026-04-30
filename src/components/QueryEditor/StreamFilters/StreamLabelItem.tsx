import { css, cx } from '@emotion/css';
import React, { ReactElement, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Toggletip, useStyles2 } from '@grafana/ui';

interface Props {
  name: string;
  description?: string;
  active: boolean;
  popoverContent?: ReactElement;
  onClick: (name: string) => void;
  onClose: () => void;
}

export const StreamLabelItem: React.FC<Props> = ({
  name,
  description,
  active,
  popoverContent,
  onClick,
  onClose,
}) => {
  const styles = useStyles2(getStyles);
  const handleClick = useCallback(() => onClick(name), [name, onClick]);

  const button = (
    <button
      type='button'
      className={cx(styles.item, active && styles.itemActive)}
      onClick={handleClick}
      title={name}
    >
      <span className={styles.itemName}>{name}</span>
      {description && <span className={styles.itemMeta}>{description}</span>}
    </button>
  );

  if (!active || !popoverContent) {
    return button;
  }

  return (
    <Toggletip
      content={popoverContent}
      show={active}
      onClose={onClose}
      placement='right-start'
      closeButton={false}
      fitContent
    >
      {button}
    </Toggletip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  item: css`
    background: transparent;
    border: 0;
    text-align: left;
    padding: ${theme.spacing(0.5, 1)};
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.primary};
    cursor: pointer;
    display: flex;
    align-items: baseline;
    gap: ${theme.spacing(0.5)};

    &:hover {
      background: ${theme.colors.action.hover};
    }
  `,
  itemName: css`
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  itemMeta: css`
    flex: 0 0 auto;
    color: ${theme.colors.text.secondary};
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.size.xs};
    white-space: nowrap;
  `,
  itemActive: css`
    background: ${theme.colors.action.selected};
    &:hover {
      background: ${theme.colors.action.selected};
    }
  `,
});
