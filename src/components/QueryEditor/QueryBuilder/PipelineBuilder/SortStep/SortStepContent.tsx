import { css } from '@emotion/css';
import React, { memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { AutoSizeInput, Button, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { useTemplateVariables } from '../../../../../hooks/useTemplateVariables';
import { CompatibleCombobox } from '../../../../CompatibleCombobox';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';
import StepRowLayout from '../../components/StepRowLayout';
import { serializePartialPipeline } from '../serialization/serializePartialPipeline';
import FieldNameSelect from '../shared/FieldNameSelect';
import OptionalField from '../shared/OptionalField';
import { getSharedStyles } from '../shared/styles';
import { useFieldFetch } from '../shared/useFieldFetch';
import { useOptionalField } from '../shared/useOptionalField';
import { PipelineStepItem, PipelineStepPatch, SortStep } from '../types';

import { createSortField, SORT_DIRECTION } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  onDeleteStep: (id: string) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

const DIRECTION_OPTIONS = [
  { label: 'asc', value: SORT_DIRECTION.Asc },
  { label: 'desc', value: SORT_DIRECTION.Desc },
];

const SortStepContent = memo(function SortStepContent({ step, datasource, timeRange, onStepChange, onDeleteStep, steps, stepIndex }: Props) {
  const shared = useStyles2(getSharedStyles);
  const styles = useStyles2(getStyles);
  const sortStep = step as SortStep;
  const sortFields = useMemo(() => sortStep.rows ?? [], [sortStep.rows]);
  const queryContext = useMemo(
    () => serializePartialPipeline(steps, stepIndex),
    [steps, stepIndex]
  );
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext });
  const { filterSelection } = useTemplateVariables();

  const updateStep = useCallback(
    (patch: PipelineStepPatch) => onStepChange(step.id, patch),
    [onStepChange, step.id]
  );

  const handleFieldChange = useCallback(
    (index: number, field: string) => {
      const newFields = [...sortFields];
      newFields[index] = { ...newFields[index], field };
      updateStep({ rows: newFields } as PipelineStepPatch);
    },
    [sortFields, updateStep]
  );

  const handleDirectionChange = useCallback(
    (index: number, option: { value?: string; label?: string } | null) => {
      if (!option?.value) {
        return;
      }
      const newFields = [...sortFields];
      newFields[index] = { ...newFields[index], direction: option.value as typeof SORT_DIRECTION.Asc | typeof SORT_DIRECTION.Desc };
      updateStep({ rows: newFields } as PipelineStepPatch);
    },
    [sortFields, updateStep]
  );

  const handleAddField = useCallback(() => {
    updateStep({ rows: [...sortFields, createSortField()] } as PipelineStepPatch);
  }, [sortFields, updateStep]);

  const handleDeleteField = useCallback(
    (index: number) => {
      updateStep({ rows: sortFields.filter((_, i) => i !== index) } as PipelineStepPatch);
    },
    [sortFields, updateStep]
  );

  const offset = useOptionalField(sortStep.offset, useCallback((v) => updateStep({ offset: v }), [updateStep]));
  const limit = useOptionalField(sortStep.limit, useCallback((v) => updateStep({ limit: v }), [updateStep]));
  const rank = useOptionalField(sortStep.rankField, useCallback((v) => updateStep({ rankField: v }), [updateStep]));

  // Partition by is special — multi-select field list, not a simple string
  const isPartitionActive = sortStep.partitionByFields !== undefined;
  const selectedPartitionFields = useMemo(
    () => (sortStep.partitionByFields ?? []).map((f) => ({ label: f, value: f })),
    [sortStep.partitionByFields]
  );
  const handleAddPartition = useCallback(() => updateStep({ partitionByFields: [] }), [updateStep]);
  const handleRemovePartition = useCallback(() => updateStep({ partitionByFields: undefined }), [updateStep]);
  const handlePartitionChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      updateStep({ partitionByFields: filterSelection(selected.map((s) => s.value ?? '').filter(Boolean)) });
    },
    [updateStep, filterSelection]
  );

  return (
    <StepRowLayout onDelete={() => onDeleteStep(step.id)} canDelete={true}>
      <span className={styles.label}>sort by (</span>
      {sortFields.map((sf, index) => (
        <Stack key={sf.id} direction='row' gap={0.5} alignItems='center'>
          {index > 0 && <span className={styles.label}>,</span>}
          <FieldNameSelect
            value={sf.field}
            onChange={(value) => handleFieldChange(index, value)}
            datasource={datasource}
            timeRange={timeRange}
            queryContext={queryContext}
          />
          <CompatibleCombobox
            value={{ label: sf.direction, value: sf.direction }}
            options={DIRECTION_OPTIONS}
            onChange={(opt) => handleDirectionChange(index, opt)}
            width='auto'
            minWidth={7}
          />
          <div className={shared.removeButtonContainer}>
            <IconButton className={shared.removeButton} name='times' size='sm' tooltip='Remove sort field' onClick={() => handleDeleteField(index)} />
          </div>
        </Stack>
      ))}
      <Button variant='secondary' icon='plus' size='sm' onClick={handleAddField}>
        Add field
      </Button>
      <span className={styles.label}>)</span>
      <OptionalField label='offset' isActive={offset.isActive} onAdd={offset.handleAdd} onRemove={offset.handleRemove}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>offset</span>
          <AutoSizeInput placeholder='N' defaultValue={sortStep.offset ?? ''} minWidth={4} onCommitChange={offset.handleChange} />
        </Stack>
      </OptionalField>
      <OptionalField label='limit' isActive={limit.isActive} onAdd={limit.handleAdd} onRemove={limit.handleRemove}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>limit</span>
          <AutoSizeInput placeholder='N' defaultValue={sortStep.limit ?? ''} minWidth={4} onCommitChange={limit.handleChange} />
        </Stack>
      </OptionalField>
      {isPartitionActive && <span className={styles.label}>partition by (</span>}
      <OptionalField label='partition by' isActive={isPartitionActive} onAdd={handleAddPartition} onRemove={handleRemovePartition}>
        <CompatibleMultiCombobox
          placeholder='Select fields'
          value={selectedPartitionFields}
          options={loadFieldNames}
          onChange={handlePartitionChange}
          width='auto'
          minWidth={15}
          createCustomValue
        />
      </OptionalField>
      {isPartitionActive && <span className={styles.label}>)</span>}
      <OptionalField label='rank as' isActive={rank.isActive} onAdd={rank.handleAdd} onRemove={rank.handleRemove}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>rank as</span>
          <AutoSizeInput placeholder='field name' defaultValue={sortStep.rankField ?? ''} minWidth={10} onCommitChange={rank.handleChange} />
        </Stack>
      </OptionalField>
    </StepRowLayout>
  );
});

export default SortStepContent;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
