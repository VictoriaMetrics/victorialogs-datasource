import React, { memo, useMemo } from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { CompatibleCombobox } from '../../../../CompatibleCombobox';

import { useFieldFetch } from './useFieldFetch';

export interface FieldComponentProps {
  value: string;
  onChange: (value: string) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext?: string;
  excludeFields?: string[];
}

const FieldNameSelect = memo<FieldComponentProps>(({ value, onChange, datasource, timeRange, queryContext, excludeFields }) => {
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext, excludeFields });

  const handleChange = (option: { value?: string; label?: string } | null) => {
    if (option?.value) {
      onChange(option.value);
    }
  };

  const selectedValue = useMemo(() => (value ? { label: value, value } : null), [value]);

  return (
    <CompatibleCombobox
      placeholder='Field name'
      value={selectedValue}
      options={loadFieldNames}
      onChange={handleChange}
      width='auto'
      minWidth={12}
      createCustomValue
    />
  );
});

FieldNameSelect.displayName = 'FieldNameSelect';

export default FieldNameSelect;
