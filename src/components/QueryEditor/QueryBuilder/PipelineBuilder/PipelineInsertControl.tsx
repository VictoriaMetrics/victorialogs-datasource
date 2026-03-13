import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { STEP_CONFIG } from './stepConfig';
import { PipelineStepType } from './types';

interface Props {
  allowedTypes: PipelineStepType[];
  onInsert: (type: PipelineStepType) => void;
}

const PipelineInsertControl = memo<Props>(({ allowedTypes, onInsert }) => {
  const styles = useStyles2(getStyles);

  const handleClick = useCallback((type: PipelineStepType) => () => onInsert(type), [onInsert]);

  if (allowedTypes.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      {allowedTypes.map((type) => (
        <Button
          key={type}
          variant='secondary'
          size='sm'
          icon='plus'
          onClick={handleClick(type)}
          className={styles.button}
        >
          {STEP_CONFIG[type].label}
        </Button>
      ))}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    justify-content: center;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(0.5)} 0;
  `,
  button: css`
    opacity: 0.6;
    &:hover {
      opacity: 1;
    }
  `,
});

PipelineInsertControl.displayName = 'PipelineInsertControl';

export default PipelineInsertControl;
