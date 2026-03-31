import { css } from '@emotion/css';
import React, { Fragment, memo, useCallback, useEffect, useMemo } from 'react';

import { CoreApp, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Divider, Dropdown, IconButton, Label, Stack, Text, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { StreamFilters } from '../components/StreamFilters/StreamFilters';
import { buildStreamExtraFilters } from '../components/StreamFilters/streamFilterUtils';

import PipelineAddMenu, { buildPipelineMenu } from './PipelineAddMenu';
import { getAllowedAppendTypes, getAllowedInsertTypes } from './pipelineRules';
import { getBuilderGeneratedExpr } from './serialization/getBuilderGeneratedExpr';
import { PipelineContext } from './shared/PipelineContext';
import { STEP_CONFIG } from './stepConfig';
import { PipelineStepItem, PipelineStepPatch, PipelineStepType } from './types';
import { usePipelineActions } from './usePipelineActions';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  query: Query;
  app?: CoreApp;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
}

const QueryTooltipText = () => (
  <Text>
    Query defines the pipeline of filters and transformations applied to the selected log streams.
    <br />
    Each step in the pipeline narrows down or transforms the results from the previous step.
    <br />
    An empty query matches all logs (<code>*</code>).
  </Text>
);

const PipelineBuilder = memo<Props>(({ datasource, timeRange, query, onChange, onRunQuery }) => {
  const styles = useStyles2(getStyles);
  const steps = query.builder?.steps || [];
  const pipelineContextValue = useMemo(
    () => ({ extraStreamFilters: buildStreamExtraFilters(query.streamFilters ?? []) || undefined }),
    [query.streamFilters]
  );

  const handleStepsChange = useCallback((newSteps: PipelineStepItem[]) => {
    const expr = getBuilderGeneratedExpr(newSteps, query.streamFilters ?? []);
    onChange({
      ...query,
      expr,
      builder: {
        steps: newSteps,
      },
    });
  }, [query, onChange]);

  const handleStreamFiltersChange = useCallback((updatedQuery: Query) => {
    const expr = getBuilderGeneratedExpr(steps, updatedQuery.streamFilters ?? []);
    onChange({ ...updatedQuery, expr });
  }, [steps, onChange]);

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
    handleStepsChange(steps);
  }, []);

  return (
    <>
      <StreamFilters
        datasource={datasource}
        query={query}
        timeRange={timeRange}
        onChange={handleStreamFiltersChange}
        onRunQuery={onRunQuery}
      />
      <Divider />
      <Label className={styles.queryLabel}>
        Query
        <IconButton style={{ marginLeft: '5px' }} name='info-circle' tooltip={QueryTooltipText} />
      </Label>
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
      </PipelineContext.Provider>
    </>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  queryLabel: css`
    margin-bottom: 0;
  `,
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
