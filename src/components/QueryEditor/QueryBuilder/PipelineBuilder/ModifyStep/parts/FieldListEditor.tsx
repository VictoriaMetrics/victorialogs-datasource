import React, { memo, useCallback, useMemo } from 'react';

import { Stack } from '@grafana/ui';

import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import { useFilterFetch } from '../../FilterStep/useFilterFetch';
import { ModifyRowContentProps } from '../modifyTypeConfig';

const FieldListEditor = memo(function FieldListEditor({ row, onChange, datasource, timeRange }: ModifyRowContentProps) {
  const { loadFieldNames } = useFilterFetch({ datasource, timeRange });
  const fields = row.fieldList ?? [];

  const selectedFields = useMemo(() => fields.map((f) => ({ label: f, value: f })), [fields]);

  const handleChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onChange({ ...row, fieldList: selected.map((s) => s.value ?? '').filter(Boolean) });
    },
    [onChange, row]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <CompatibleMultiCombobox
        placeholder='Select fields'
        value={selectedFields}
        options={loadFieldNames}
        onChange={handleChange}
        width='auto'
        minWidth={16}
        createCustomValue
      />
    </Stack>
  );
});

export default FieldListEditor;
