import React, { memo, useCallback, useMemo } from 'react';

import { Stack } from '@grafana/ui';

import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import FieldNameSelect from '../../shared/FieldNameSelect';
import IfFilterInput from '../../shared/IfFilterInput';
import OptionalField from '../../shared/OptionalField';
import { useFieldFetch } from '../../shared/useFieldFetch';
import { AggregateRowContentProps } from '../aggregateTypeConfig';

const RowFunctionEditor = memo(function RowFunctionEditor({
  row,
  onChange,
  datasource,
  timeRange,
}: AggregateRowContentProps) {
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange });

  const selectedFields = useMemo(() => (row.fieldList ?? []).map((f) => ({ label: f, value: f })), [row.fieldList]);

  const handleReferenceFieldChange = useCallback(
    (value: string) => onChange({ ...row, referenceField: value }),
    [onChange, row]
  );

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

  const isReferenceActive = row.referenceField !== undefined;

  const handleAddReference = useCallback(() => onChange({ ...row, referenceField: '' }), [onChange, row]);
  const handleRemoveReference = useCallback(() => onChange({ ...row, referenceField: undefined }), [onChange, row]);

  const isFieldsActive = (row.fieldList ?? []).length > 0 || row.fieldList !== undefined;

  const handleAddFields = useCallback(() => onChange({ ...row, fieldList: [] }), [onChange, row]);
  const handleRemoveFields = useCallback(() => onChange({ ...row, fieldList: undefined }), [onChange, row]);

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <OptionalField label='reference field' isActive={isReferenceActive} onAdd={handleAddReference} onRemove={handleRemoveReference}>
        <FieldNameSelect
          value={row.referenceField ?? ''}
          onChange={handleReferenceFieldChange}
          datasource={datasource}
          timeRange={timeRange}
        />
      </OptionalField>
      <OptionalField label='output fields' isActive={isFieldsActive} onAdd={handleAddFields} onRemove={handleRemoveFields}>
        <CompatibleMultiCombobox
          placeholder='Select fields'
          value={selectedFields}
          options={loadFieldNames}
          onChange={handleFieldsChange}
          width='auto'
          minWidth={16}
          createCustomValue
        />
      </OptionalField>
    </Stack>
  );
});

export default RowFunctionEditor;
