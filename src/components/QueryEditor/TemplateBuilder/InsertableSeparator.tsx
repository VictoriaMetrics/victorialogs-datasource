import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './styles';

interface Props {
  index: number;
  onInsertAt: (index: number, buttonEl: HTMLButtonElement) => void;
}

export const InsertableSeparator: React.FC<Props> = ({ index, onInsertAt }) => {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.insertSeparator}>
      <span className={styles.pipeSeparator}>|</span>
      <button
        className={`${styles.insertSeparatorButton} insert-btn`}
        onClick={(e) => onInsertAt(index, e.currentTarget)}
        onMouseDown={(e) => e.preventDefault()}
        type='button'
        aria-label='Insert pipe here'
        title='Insert pipe here'
      >
        +
      </button>
    </span>
  );
};
