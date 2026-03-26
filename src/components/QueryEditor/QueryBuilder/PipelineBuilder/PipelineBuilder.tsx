import { css } from '@emotion/css';
import React, { Fragment, memo, useCallback, useEffect, useMemo } from 'react';

import { CoreApp, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Divider, Dropdown, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { buildStreamExtraFilters } from '../components/StreamFilters/streamFilterUtils';

import PipelineAddMenu, { buildPipelineMenu } from './PipelineAddMenu';
import PipelineExpressionPreview from './PipelineExpressionPreview';
import { getAllowedAppendTypes, getAllowedInsertTypes } from './pipelineRules';
import { serializePipeline } from './serialization/serializePipeline';
import { PipelineContext } from './shared/PipelineContext';
import { STEP_CONFIG } from './stepConfig';
import { PipelineStepItem, PipelineStepPatch, PipelineStepType } from './types';
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
  const steps = query.builder?.steps;
  const pipelineContextValue = useMemo(
    () => ({ extraStreamFilters: buildStreamExtraFilters(query.streamFilters ?? []) || undefined }),
    [query.streamFilters]
  );

  const handleStepsChange = useCallback((newSteps: PipelineStepItem[]) => {
    const serializedQuery = serializePipeline(newSteps);
    onChange({
      ...query,
      expr: serializedQuery || '*',
      builder: {
        steps: newSteps,
      },
    });
  }, [query, onChange]);

  const { addStep, deleteStep, updateStep, insertStep } = usePipelineActions(steps, handleStepsChange);

  const allowedAppendTypes = useMemo(() => getAllowedAppendTypes(steps), [steps]);

  const handleAddStep = useCallback(
    (type: PipelineStepType, initialPatch?: PipelineStepPatch) => addStep(type, initialPatch),
    [addStep]
  );

  const handleInsertStep = useCallback(
    (index: number) => (type: PipelineStepType, initialPatch?: PipelineStepPatch) => insertStep(index, type, initialPatch),
    [insertStep]
  );

  useEffect(() => {
    if (!query.builder?.steps?.length) {
      handleStepsChange(createInitialSteps());
    }
  }, []);

  return (
    <>
      <Divider />
      <PipelineContext.Provider value={pipelineContextValue}>
        <Stack direction='row' alignItems={'center'} wrap={'wrap'}>
          {steps.map((step, index) => {
            const config = STEP_CONFIG[step.type];
            const ContentComponent = config.ContentComponent;

            const insertAllowed = index > 0 ? getAllowedInsertTypes(steps, index) : [];

            return (
              <Fragment key={step.id}>
                {index > 0 && (
                  insertAllowed.length > 0 ? (
                    <Dropdown overlay={buildPipelineMenu(insertAllowed, handleInsertStep(index))} placement='bottom-start'>
                      <span className={styles.pipeSeparatorInteractive} title='Insert pipe'>|</span>
                    </Dropdown>
                  ) : (
                    <span className={styles.pipeSeparator}>|</span>
                  )
                )}
                {ContentComponent && (
                  <ContentComponent
                    step={step}
                    datasource={datasource}
                    timeRange={timeRange}
                    onStepChange={updateStep}
                    onDeleteStep={deleteStep}
                    steps={steps}
                    stepIndex={index}
                  />
                )}
              </Fragment>
            );
          })}
          {allowedAppendTypes.length > 0 && (
            <PipelineAddMenu allowedTypes={allowedAppendTypes} onAddStep={handleAddStep} />
          )}
        </Stack>
        <PipelineExpressionPreview expr={query.expr} streamFilters={query.streamFilters} />
      </PipelineContext.Provider>
    </>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  pipeSeparator: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.h4.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
    user-select: none;
    padding: 0 ${theme.spacing(0.5)};
  `,
  pipeSeparatorInteractive: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.h4.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
    user-select: none;
    padding: 0 ${theme.spacing(0.5)};
    cursor: pointer;
    border-radius: ${theme.shape.radius.default};
    transition: color 0.15s ease, background-color 0.15s ease;

    &:hover {
      color: transparent;
      background-color: ${theme.colors.action.hover};

      &::after {
        content: '+';
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${theme.colors.text.primary};
      }
    }

    position: relative;
  `,
});

PipelineBuilder.displayName = 'PipelineBuilder';

export default PipelineBuilder;
