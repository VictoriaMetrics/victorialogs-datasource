import React, { memo, useCallback } from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import FilterRowLayout from '../../components/FilterRowLayout';
import { FilterRow } from '../types';

import FILTER_TYPE_CONFIG from './filterTypeConfig';

interface Props {
  row: FilterRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: FilterRow) => void;
  onDelete: () => void;
}

const FilterRowContainer = memo<Props>(({ row, datasource, timeRange, canDelete, onChange, onDelete }) => {
  const config = FILTER_TYPE_CONFIG[row.filterType];
  const { FieldComponent, OperatorComponent, ValueComponent } = config;

  const handleFieldChange = useCallback(
    (value: string) => {
      onChange({ ...row, fieldName: value, values: [] });
    },
    [onChange, row]
  );

  const handleOperatorChange = useCallback(
    (value: string) => {
      onChange({ ...row, operator: value, values: [] });
    },
    [onChange, row]
  );

  const handleValueChange = useCallback(
    (values: string[]) => {
      onChange({ ...row, values });
    },
    [onChange, row]
  );

  return (
    <FilterRowLayout
      onDelete={onDelete}
      canDelete={canDelete}
      disabledDeleteTooltip='At least one filter is required'
    >
      <FieldComponent
        value={row.fieldName}
        onChange={handleFieldChange}
        datasource={datasource}
        timeRange={timeRange}
      />
      <OperatorComponent value={row.operator} onChange={handleOperatorChange} />
      <ValueComponent
        key={row.fieldName}
        values={row.values}
        onChange={handleValueChange}
        fieldName={row.fieldName}
        datasource={datasource}
        timeRange={timeRange}
      />
    </FilterRowLayout>
  );
});

FilterRowContainer.displayName = 'FilterRowContainer';

export default FilterRowContainer;
