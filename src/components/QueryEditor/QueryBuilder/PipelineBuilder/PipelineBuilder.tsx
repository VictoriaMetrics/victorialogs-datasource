import { css } from '@emotion/css';
import React, { Fragment, memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import PipelineInsertControl from './PipelineInsertControl';
import PipelineStep from './PipelineStep';
import { getAllowedAppendTypes, getAllowedInsertTypes } from './pipelineRules';
import { PipelineStepType, STEP_TYPE_LABELS } from './types';
import { usePipelineState } from './usePipelineState';

const PipelineBuilder = memo(() => {
  const styles = useStyles2(getStyles);
  const { steps, addStep, insertStep, deleteStep } = usePipelineState();

  const allowedAppendTypes = useMemo(() => getAllowedAppendTypes(steps), [steps]);

  const handleAppend = useCallback((type: PipelineStepType) => () => addStep(type), [addStep]);

  return (
    <div className={styles.container}>
      <Stack direction='column' gap={0}>
        {steps.map((step, index) => (
          <Fragment key={step.id}>
            {/* Insert control above each step except the first */}
            {index > 0 && (
              <PipelineInsertControl
                allowedTypes={getAllowedInsertTypes(steps, index)}
                onInsert={(type) => insertStep(index, type)}
              />
            )}
            <PipelineStep step={step} index={index} onDelete={deleteStep} />
          </Fragment>
        ))}
      </Stack>

      {/* Append control at the end */}
      {allowedAppendTypes.length > 0 && (
        <div className={styles.addStepRow}>
          {allowedAppendTypes.map((type) => (
            <Button key={type} variant='secondary' icon='plus' onClick={handleAppend(type)}>
              {STEP_TYPE_LABELS[type]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(2)};
  `,
  addStepRow: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
  `,
  endLabel: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    padding: ${theme.spacing(1)} 0;
  `,
});

PipelineBuilder.displayName = 'PipelineBuilder';

export default PipelineBuilder;
