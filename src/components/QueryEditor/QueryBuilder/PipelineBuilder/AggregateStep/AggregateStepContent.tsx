import { css } from '@emotion/css';
import React, { memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Button, Dropdown, Label, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';
import StepRowLayout from '../../components/StepRowLayout';
import OptionalField from '../shared/OptionalField';
import { useFieldFetch } from '../shared/useFieldFetch';
import { useQueryContexts } from '../shared/useQueryContexts';
import { useRowManagement } from '../shared/useRowManagement';
import { AggregateStep, PipelineStepItem, PipelineStepPatch } from '../types';

import AggregateRowContainer from './AggregateRowContainer';
import { AGGREGATE_TYPE_FLAT_ENTRIES } from './aggregateTypeConfig';
import { AggregateRow } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  onDeleteStep: (id: string) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const AggregateStepContent = memo(function AggregateStepContent({
  step,
  datasource,
  timeRange,
  onStepChange,
  onDeleteStep,
  steps,
  stepIndex,
}: Props) {
  const styles = useStyles2(getStyles);
  const aggregateStep = step as AggregateStep;
  const rows = aggregateStep.rows ?? [];
  const queryContexts = useQueryContexts(steps, stepIndex, Math.max(rows.length, 1));
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext: queryContexts[0] });

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<AggregateRow>({
    rows,
    stepId: step.id,
    onStepChange,
    onDeleteStep,
  });

  const selectedByFields = useMemo(
    () => (aggregateStep.byFields ?? []).map((f) => ({ label: f, value: f })),
    [aggregateStep.byFields]
  );

  const handleByFieldsChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onStepChange(step.id, {
        byFields: selected.map((s) => s.value ?? '').filter(Boolean),
      });
    },
    [onStepChange, step.id]
  );

  const isByFieldsActive = aggregateStep.byFields !== undefined;

  const handleAddByFields = useCallback(
    () => onStepChange(step.id, { byFields: [] }),
    [onStepChange, step.id]
  );

  const handleRemoveByFields = useCallback(
    () => onStepChange(step.id, { byFields: undefined }),
    [onStepChange, step.id]
  );

  const addFunctionMenu = (
    <Menu>
      {AGGREGATE_TYPE_FLAT_ENTRIES.map(({ aggregateType, label, description, createPatch }) => (
        <Menu.Item
          key={aggregateType}
          label={label}
          description={description}
          onClick={() => handleAddRow(((createPatch() as unknown) as { rows: AggregateRow[] }).rows[0])}
        />
      ))}
    </Menu>
  );

  return (
    <StepRowLayout onDelete={() => onDeleteStep(step.id)} canDelete={true}>
      <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
        <span className={styles.statsLabel}>stats</span>
        <OptionalField label='by' isActive={isByFieldsActive} onAdd={handleAddByFields} onRemove={handleRemoveByFields}>
          <Stack direction='row' gap={0.5} alignItems='center'>
            <Label className={styles.byLabel}>by</Label>
            <CompatibleMultiCombobox
              placeholder='Select fields'
              value={selectedByFields}
              options={loadFieldNames}
              onChange={handleByFieldsChange}
              width='auto'
              minWidth={15}
              createCustomValue
            />
          </Stack>
        </OptionalField>
        {rows.map((row, index) => (
          <React.Fragment key={row.id}>
            {index > 0 && <span className={styles.comma}>,</span>}
            <AggregateRowContainer
              row={row}
              datasource={datasource}
              timeRange={timeRange}
              canDelete={true}
              onChange={handleRowChange}
              onDelete={() => handleRowDelete(row.id)}
              queryContext={queryContexts[index]}
            />
          </React.Fragment>
        ))}
        <Dropdown overlay={addFunctionMenu} placement='bottom-start'>
          <Button variant='secondary' icon='plus' size='sm'>
            Add function
          </Button>
        </Dropdown>
      </Stack>
    </StepRowLayout>
  );
});

export default AggregateStepContent;

const getStyles = (theme: GrafanaTheme2) => ({
  statsLabel: css`
    font-weight: ${theme.typography.fontWeightBold};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.primary};
    padding: 0 ${theme.spacing(0.5)};
    white-space: nowrap;
  `,
  byLabel: css`
    margin: 0;
    white-space: nowrap;
  `,
  comma: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    padding-left: ${theme.spacing(0.5)};
  `,
});
