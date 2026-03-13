import { css } from '@emotion/css';
import React, { memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { AutoSizeInput, Button, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { CompatibleCombobox } from '../../../../CompatibleCombobox';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';
import FieldNameSelect from '../shared/FieldNameSelect';
import OptionalField from '../shared/OptionalField';
import { useFieldFetch } from '../shared/useFieldFetch';
import { PipelineStepItem } from '../types';

import { createSortField, SORT_DIRECTION } from './types';

interface Props {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: Partial<Omit<PipelineStepItem, 'id' | 'type'>>) => void;
}

const DIRECTION_OPTIONS = [
  { label: 'asc', value: SORT_DIRECTION.Asc },
  { label: 'desc', value: SORT_DIRECTION.Desc },
];

const SortStepContent = memo(function SortStepContent({ step, datasource, timeRange, onStepChange }: Props) {
  const styles = useStyles2(getStyles);
  const sortFields = useMemo(() => step.sortFields ?? [], [step.sortFields]);
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange });

  const updateStep = useCallback(
    (patch: Partial<Omit<PipelineStepItem, 'id' | 'type'>>) => {
      onStepChange(step.id, patch);
    },
    [onStepChange, step.id]
  );

  const handleFieldChange = useCallback(
    (index: number, field: string) => {
      const newFields = [...sortFields];
      newFields[index] = { ...newFields[index], field };
      updateStep({ sortFields: newFields });
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
      updateStep({ sortFields: newFields });
    },
    [sortFields, updateStep]
  );

  const handleAddField = useCallback(() => {
    updateStep({ sortFields: [...sortFields, createSortField()] });
  }, [sortFields, updateStep]);

  const handleDeleteField = useCallback(
    (index: number) => {
      if (sortFields.length <= 1) {
        return;
      }
      const newFields = sortFields.filter((_, i) => i !== index);
      updateStep({ sortFields: newFields });
    },
    [sortFields, updateStep]
  );

  // Optional: offset
  const isOffsetActive = step.sortOffset !== undefined;
  const handleAddOffset = useCallback(() => updateStep({ sortOffset: '' }), [updateStep]);
  const handleRemoveOffset = useCallback(() => updateStep({ sortOffset: undefined }), [updateStep]);
  const handleOffsetChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => updateStep({ sortOffset: e.currentTarget.value }),
    [updateStep]
  );

  // Optional: limit
  const isLimitActive = step.sortLimit !== undefined;
  const handleAddLimit = useCallback(() => updateStep({ sortLimit: '' }), [updateStep]);
  const handleRemoveLimit = useCallback(() => updateStep({ sortLimit: undefined }), [updateStep]);
  const handleLimitChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => updateStep({ sortLimit: e.currentTarget.value }),
    [updateStep]
  );

  // Optional: partition by
  const isPartitionActive = step.sortPartitionByFields !== undefined;
  const selectedPartitionFields = useMemo(
    () => (step.sortPartitionByFields ?? []).map((f) => ({ label: f, value: f })),
    [step.sortPartitionByFields]
  );
  const handleAddPartition = useCallback(() => updateStep({ sortPartitionByFields: [] }), [updateStep]);
  const handleRemovePartition = useCallback(() => updateStep({ sortPartitionByFields: undefined }), [updateStep]);
  const handlePartitionChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      updateStep({ sortPartitionByFields: selected.map((s) => s.value ?? '').filter(Boolean) });
    },
    [updateStep]
  );

  // Optional: rank as
  const isRankActive = step.sortRankField !== undefined;
  const handleAddRank = useCallback(() => updateStep({ sortRankField: '' }), [updateStep]);
  const handleRemoveRank = useCallback(() => updateStep({ sortRankField: undefined }), [updateStep]);
  const handleRankChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => updateStep({ sortRankField: e.currentTarget.value }),
    [updateStep]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <span className={styles.label}>by (</span>
      {sortFields.map((sf, index) => (
        <Stack key={sf.id} direction='row' gap={0.5} alignItems='center'>
          {index > 0 && <span className={styles.label}>,</span>}
          <FieldNameSelect
            value={sf.field}
            onChange={(value) => handleFieldChange(index, value)}
            datasource={datasource}
            timeRange={timeRange}
          />
          <CompatibleCombobox
            value={{ label: sf.direction, value: sf.direction }}
            options={DIRECTION_OPTIONS}
            onChange={(opt) => handleDirectionChange(index, opt)}
            width='auto'
            minWidth={7}
          />
          {sortFields.length > 1 && (
            <div className={styles.removeButtonContainer}>
              <IconButton className={styles.removeButton} name='times' size='sm' tooltip='Remove sort field' onClick={() => handleDeleteField(index)} />
            </div>
          )}
        </Stack>
      ))}
      <Button variant='secondary' icon='plus' size='sm' onClick={handleAddField}>
        Add field
      </Button>
      <span className={styles.label}>)</span>
      <OptionalField label='offset' isActive={isOffsetActive} onAdd={handleAddOffset} onRemove={handleRemoveOffset}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>offset</span>
          <AutoSizeInput placeholder='N' defaultValue={step.sortOffset ?? ''} minWidth={4} onCommitChange={handleOffsetChange} />
        </Stack>
      </OptionalField>
      <OptionalField label='limit' isActive={isLimitActive} onAdd={handleAddLimit} onRemove={handleRemoveLimit}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>limit</span>
          <AutoSizeInput placeholder='N' defaultValue={step.sortLimit ?? ''} minWidth={4} onCommitChange={handleLimitChange} />
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
      <OptionalField label='rank as' isActive={isRankActive} onAdd={handleAddRank} onRemove={handleRemoveRank}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>rank as</span>
          <AutoSizeInput placeholder='field name' defaultValue={step.sortRankField ?? ''} minWidth={10} onCommitChange={handleRankChange} />
        </Stack>
      </OptionalField>
    </Stack>
  );
});

export default SortStepContent;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  removeButtonContainer: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    width: 23px;
    border: 1px solid ${theme.colors.border.medium};
    border-left: none;
    border-radius: 0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0;
  `,
  removeButton: css`
    margin: 0;
    width: 100%;
    height: 100%;
    &::before {
      width: 100%;
      height: 100%;
      border-radius: 0;
    }
  `,
});
