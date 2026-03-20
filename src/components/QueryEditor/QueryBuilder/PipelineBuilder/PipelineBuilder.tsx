import { css } from '@emotion/css';
import React, { Fragment, memo, useCallback, useMemo } from 'react';

import { CoreApp, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import PipelineInsertControl from './PipelineInsertControl';
import PipelineStep from './PipelineStep';
import { getAllowedAppendTypes, getAllowedInsertTypes } from './pipelineRules';
import { serializePipeline } from './serialization/serializePipeline';
import { STEP_CONFIG } from './stepConfig';
import { PipelineStepItem, PipelineStepType } from './types';
import { createInitialSteps, usePipelineActions } from './usePipelineActions';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  query: Query;
  app?: CoreApp;
  onChange: (query: Query) => void;
}

const PipelineBuilder = memo<Props>(({ datasource, timeRange, query, onChange }) => {
  const styles = useStyles2(getStyles);
  const steps = query.builder?.steps ?? createInitialSteps();

  const handleStepsChange = useCallback((newSteps: PipelineStepItem[]) => {
    const serializedQuery = serializePipeline(newSteps);
    onChange({
      ...query,
      expr: serializedQuery,
      builder: {
        steps: newSteps,
      },
    });
  }, [query, onChange]);

  const { addStep, insertStep, deleteStep, updateStep } = usePipelineActions(steps, handleStepsChange);

  const allowedAppendTypes = useMemo(() => getAllowedAppendTypes(steps), [steps]);

  const handleAppend = useCallback((type: PipelineStepType) => () => addStep(type), [addStep]);

  return (
    <div className={styles.container}>
      <Stack direction='column' gap={1}>
        {steps.map((step, index) => (
          <Fragment key={step.id}>
            {/* Insert control above each step except the first */}
            {index > 0 && (
              <PipelineInsertControl
                allowedTypes={getAllowedInsertTypes(steps, index)}
                onInsert={(type) => insertStep(index, type)}
              />
            )}
            <PipelineStep
              step={step}
              index={index}
              datasource={datasource}
              timeRange={timeRange}
              onDelete={deleteStep}
              onStepChange={updateStep}
              steps={steps}
            />
          </Fragment>
        ))}
      </Stack>

      {/* Append control at the end */}
      {allowedAppendTypes.length > 0 && (
        <div className={styles.addStepRow}>
          {allowedAppendTypes.map((type) => (
            <Button key={type} variant='secondary' icon='plus' onClick={handleAppend(type)}>
              {STEP_CONFIG[type].label}
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

export default PipelineBuilder;
