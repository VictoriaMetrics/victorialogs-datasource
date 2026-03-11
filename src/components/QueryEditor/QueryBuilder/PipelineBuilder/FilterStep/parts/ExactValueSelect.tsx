import React, { memo, useMemo } from 'react';


import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import { useFilterFetch } from '../useFilterFetch';

import { ValueComponentProps } from './TextValueInput';

const ExactValueSelect = ({ values, onChange, fieldName, datasource, timeRange }: ValueComponentProps) => {
  const { loadFieldValues } = useFilterFetch({
    datasource,
    field: fieldName || undefined,
    timeRange,
  });

  const selectedValues = useMemo(() => values.map((v) => ({ label: v, value: v })), [values]);

  const handleChange = (selected: Array<{ value?: string; label?: string }>) => {
    onChange(selected.map((s) => s.value ?? '').filter(Boolean));
  };

  return (
    <CompatibleMultiCombobox
      key={fieldName}
      placeholder='Select values'
      value={selectedValues}
      options={fieldName ? loadFieldValues : []}
      onChange={handleChange}
      width='auto'
      minWidth={16}
      createCustomValue
    />
  );
};

export default memo<ValueComponentProps>(ExactValueSelect);

