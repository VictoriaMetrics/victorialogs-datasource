import React, { memo, useCallback, useMemo } from 'react';

import { AutoSizeInput, Stack } from '@grafana/ui';

import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import OptionalField from '../../shared/OptionalField';
import { useFieldFetch } from '../../shared/useFieldFetch';
import { LimitRowContentProps } from '../limitTypeConfig';
import { LIMIT_TYPE } from '../types';

const NumberWithFieldsEditor = memo(function NumberWithFieldsEditor({
  row,
  onChange,
  datasource,
  timeRange,
}: LimitRowContentProps) {
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange });

  const handleCountChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...row, count: e.currentTarget.value });
    },
    [onChange, row]
  );

  const selectedFields = useMemo(
    () => (row.fieldList ?? []).map((f) => ({ label: f, value: f })),
    [row.fieldList]
  );

  const handleFieldsChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onChange({ ...row, fieldList: selected.map((s) => s.value ?? '').filter(Boolean) });
    },
    [onChange, row]
  );

  // partition by is only for first/last
  const supportsPartition = row.limitType === LIMIT_TYPE.First || row.limitType === LIMIT_TYPE.Last;
  const isPartitionActive = row.partitionByFields !== undefined;

  const selectedPartitionFields = useMemo(
    () => (row.partitionByFields ?? []).map((f) => ({ label: f, value: f })),
    [row.partitionByFields]
  );

  const handleAddPartition = useCallback(
    () => onChange({ ...row, partitionByFields: [] }),
    [onChange, row]
  );

  const handleRemovePartition = useCallback(
    () => onChange({ ...row, partitionByFields: undefined }),
    [onChange, row]
  );

  const handlePartitionFieldsChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onChange({ ...row, partitionByFields: selected.map((s) => s.value ?? '').filter(Boolean) });
    },
    [onChange, row]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <AutoSizeInput
        placeholder='N'
        defaultValue={row.count ?? ''}
        minWidth={6}
        onCommitChange={handleCountChange}
      />
      <CompatibleMultiCombobox
        placeholder='Select fields'
        value={selectedFields}
        options={loadFieldNames}
        onChange={handleFieldsChange}
        width='auto'
        minWidth={15}
        createCustomValue
      />
      {supportsPartition && (
        <OptionalField
          label='partition by'
          isActive={isPartitionActive}
          onAdd={handleAddPartition}
          onRemove={handleRemovePartition}
        >
          <CompatibleMultiCombobox
            placeholder='Select fields'
            value={selectedPartitionFields}
            options={loadFieldNames}
            onChange={handlePartitionFieldsChange}
            width='auto'
            minWidth={15}
            createCustomValue
          />
        </OptionalField>
      )}
    </Stack>
  );
});

export default NumberWithFieldsEditor;
