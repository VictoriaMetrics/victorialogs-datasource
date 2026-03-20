import React, { memo, useCallback, useMemo } from 'react';

import { AutoSizeInput, Stack } from '@grafana/ui';

import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import IfFilterInput from '../../shared/IfFilterInput';
import OptionalField from '../../shared/OptionalField';
import { useFieldFetch } from '../../shared/useFieldFetch';
import { useOptionalField } from '../../shared/useOptionalField';
import { AggregateRowContentProps } from '../aggregateTypeConfig';

const FieldListWithLimitEditor = memo(function FieldListWithLimitEditor({
  row,
  onChange,
  datasource,
  timeRange,
  queryContext,
}: AggregateRowContentProps) {
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext });

  const selectedFields = useMemo(() => (row.fieldList ?? []).map((f) => ({ label: f, value: f })), [row.fieldList]);

  const handleFieldsChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onChange({ ...row, fieldList: selected.map((s) => s.value ?? '').filter(Boolean) });
    },
    [onChange, row]
  );

  const handleIfFilterChange = useCallback(
    (value: string | undefined) => onChange({ ...row, ifFilter: value }),
    [onChange, row]
  );

  const limitField = useOptionalField(row.limit, useCallback((v) => onChange({ ...row, limit: v }), [onChange, row]));

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <CompatibleMultiCombobox
        placeholder='Select fields'
        value={selectedFields}
        options={loadFieldNames}
        onChange={handleFieldsChange}
        width='auto'
        minWidth={16}
        createCustomValue
      />
      <OptionalField label='limit' isActive={limitField.isActive} onAdd={limitField.handleAdd} onRemove={limitField.handleRemove}>
        <AutoSizeInput
          placeholder='N'
          defaultValue={row.limit ?? ''}
          minWidth={4}
          onCommitChange={limitField.handleChange}
        />
      </OptionalField>
    </Stack>
  );
});

export default FieldListWithLimitEditor;
