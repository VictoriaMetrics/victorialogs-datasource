import React, { memo, useCallback, useMemo } from 'react';

import { AutoSizeInput, Stack } from '@grafana/ui';

import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import IfFilterInput from '../../shared/IfFilterInput';
import { useFieldFetch } from '../../shared/useFieldFetch';
import { AggregateRowContentProps } from '../aggregateTypeConfig';

const QuantileEditor = memo(function QuantileEditor({ row, onChange, datasource, timeRange }: AggregateRowContentProps) {
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange });

  const selectedFields = useMemo(() => (row.fieldList ?? []).map((f) => ({ label: f, value: f })), [row.fieldList]);

  const handlePhiChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, phi: e.currentTarget.value }),
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

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <AutoSizeInput
        placeholder='phi (0-1)'
        defaultValue={row.phi ?? ''}
        minWidth={8}
        onCommitChange={handlePhiChange}
      />
      <CompatibleMultiCombobox
        placeholder='Select fields'
        value={selectedFields}
        options={loadFieldNames}
        onChange={handleFieldsChange}
        width='auto'
        minWidth={16}
        createCustomValue
      />
    </Stack>
  );
});

export default QuantileEditor;
