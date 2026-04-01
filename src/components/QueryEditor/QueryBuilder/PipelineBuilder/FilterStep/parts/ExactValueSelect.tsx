import React, { memo, useMemo } from 'react';


import { useTemplateVariables } from '../../../../../../hooks/useTemplateVariables';
import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import { useFieldFetch } from '../../shared/useFieldFetch';

import { ValueComponentProps } from './TextValueInput';

const ExactValueSelect = ({ values, onChange, fieldName, datasource, timeRange, queryContext }: ValueComponentProps) => {
  const { filterSelection } = useTemplateVariables();
  const { loadFieldValues } = useFieldFetch({
    datasource,
    field: fieldName || undefined,
    timeRange,
    queryContext,
  });

  const selectedValues = useMemo(() => values.map((v) => ({ label: v, value: v })), [values]);

  const handleChange = (selected: Array<{ value?: string; label?: string }>) => {
    onChange(filterSelection(selected.map((s) => s.value ?? '').filter(Boolean)));
  };

  return (
    <CompatibleMultiCombobox
      key={fieldName}
      placeholder='Select values'
      value={selectedValues}
      options={fieldName ? loadFieldValues : []}
      onChange={handleChange}
      width='auto'
      minWidth={20}
      maxWidth={70}
      createCustomValue
    />
  );
};

export default memo<ValueComponentProps>(ExactValueSelect);

