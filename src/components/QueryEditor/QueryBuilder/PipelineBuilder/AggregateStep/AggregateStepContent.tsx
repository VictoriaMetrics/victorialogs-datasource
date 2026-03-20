import React, { memo, useCallback, useMemo } from 'react';

import { TimeRange } from '@grafana/data';
import { Button, Dropdown, Label, Menu, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';
import { serializePartialPipeline } from '../serialization/serializePartialPipeline';
import OptionalField from '../shared/OptionalField';
import { getSharedStyles } from '../shared/styles';
import { useFieldFetch } from '../shared/useFieldFetch';
import { useRowManagement } from '../shared/useRowManagement';
import { AggregateStep, PipelineStepItem, PipelineStepPatch } from '../types';

import AggregateRowContainer from './AggregateRowContainer';
import AGGREGATE_TYPE_CONFIG, { AGGREGATE_TYPE_FLAT_ENTRIES } from './aggregateTypeConfig';
import { AGGREGATE_TYPE, AggregateRow, AggregateType, createAggregateRow } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const AggregateStepContent = memo(function AggregateStepContent({
  step,
  datasource,
  timeRange,
  onStepChange,
  steps,
  stepIndex,
}: Props) {
  const styles = useStyles2(getSharedStyles);
  const aggregateStep = step as AggregateStep;
  const rows = aggregateStep.rows ?? [];
  const stepQueryContext = useMemo(
    () => serializePartialPipeline(steps, stepIndex),
    [steps, stepIndex]
  );
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext: stepQueryContext });

  const getQueryContext = useCallback(
    (rowIndex: number) => serializePartialPipeline(steps, stepIndex, rowIndex),
    [steps, stepIndex]
  );

  const { handleRowChange, handleRowDelete, handleAddRow } = useRowManagement<AggregateRow>({
    rows,
    stepId: step.id,
    onStepChange,
  });

  const onAddAggregate = useCallback(
    (aggregateType: AggregateType) => {
      handleAddRow(createAggregateRow(aggregateType, AGGREGATE_TYPE_CONFIG[aggregateType].createInitialRow()));
    },
    [handleAddRow]
  );

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

  const menu = (
    <Menu>
      {AGGREGATE_TYPE_FLAT_ENTRIES.map(({ aggregateType, label, description }) => (
        <Menu.Item
          key={aggregateType}
          label={label}
          description={description}
          onClick={() => onAddAggregate(aggregateType)}
        />
      ))}
      <Menu.Divider />
      <Menu.Item label='Custom' onClick={() => onAddAggregate(AGGREGATE_TYPE.CustomPipe)} />
    </Menu>
  );

  return (
    <Stack direction='column' gap={1} alignItems='flex-start' wrap='wrap'>
      <OptionalField label='group by' isActive={isByFieldsActive} onAdd={handleAddByFields} onRemove={handleRemoveByFields}>
        <Stack alignItems='center'>
          <Label>group by</Label>
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
      <Stack direction='row' gap={1} alignItems='center' wrap='wrap'>
        {rows.map((row, index) => (
          <React.Fragment key={row.id}>
            {index > 0 && <span className={styles.separator} />}
            <AggregateRowContainer
              row={row}
              datasource={datasource}
              timeRange={timeRange}
              canDelete={true}
              onChange={handleRowChange}
              onDelete={() => handleRowDelete(row.id)}
              queryContext={getQueryContext(index)}
            />
          </React.Fragment>
        ))}
        <Dropdown overlay={menu}>
          <Button variant='secondary' icon='plus' size='sm'>
            Add aggregate
          </Button>
        </Dropdown>
      </Stack>
    </Stack>
  );
});

export default AggregateStepContent;
