import { css } from '@emotion/css';
import React, { Fragment, memo, useCallback, useMemo } from 'react';

import { CoreApp, GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { buildStreamExtraFilters } from '../components/StreamFilters/streamFilterUtils';

import PipelineAddMenu from './PipelineAddMenu';
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
  const steps = query.builder?.steps ?? createInitialSteps();
  const pipelineContextValue = useMemo(
    () => ({ extraStreamFilters: buildStreamExtraFilters(query.streamFilters ?? []) || undefined }),
    [query.streamFilters]
  );

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

  return (
    <PipelineContext.Provider value={pipelineContextValue}>
      <div className={styles.container}>
        {steps.map((step, index) => {
          const config = STEP_CONFIG[step.type];
          const ContentComponent = config.ContentComponent;

          const insertAllowed = index > 0 ? getAllowedInsertTypes(steps, index) : [];

          return (
            <Fragment key={step.id}>
              {index > 0 && (
                <>
                  <span className={styles.pipeSeparator}>|</span>
                  {insertAllowed.length > 0 && (
                    <PipelineAddMenu
                      allowedTypes={insertAllowed}
                      onAddStep={handleInsertStep(index)}
                      variant='insert'
                    />
                  )}
                </>
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
      </div>
    </PipelineContext.Provider>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(2)};
  `,
  pipeSeparator: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.h4.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
    user-select: none;
    padding: 0 ${theme.spacing(0.5)};
  `,
});

PipelineBuilder.displayName = 'PipelineBuilder';

export default PipelineBuilder;
