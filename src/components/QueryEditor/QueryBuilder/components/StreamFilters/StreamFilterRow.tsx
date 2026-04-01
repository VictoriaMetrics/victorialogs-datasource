import React, { useCallback, useMemo } from 'react';

import { SelectableValue, TimeRange } from '@grafana/data';
import { ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { useTemplateVariables } from '../../../../../hooks/useTemplateVariables';
import { StreamFilterOperator, StreamFilterState } from '../../../../../types';
import { CompatibleCombobox } from '../../../../CompatibleCombobox';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';
import StepRowLayout from '../StepRowLayout';

import { useFetchStreamFilters } from './useFetchStreamFilters';

const OPERATOR_OPTIONS: ComboboxOption<StreamFilterOperator>[] = [
  { label: 'in', value: 'in' },
  { label: 'not in', value: 'not_in' },
];

interface Props {
  datasource: VictoriaLogsDatasource;
  filter: StreamFilterState;
  timeRange?: TimeRange;
  /** extra_stream_filters built from preceding filters */
  extraStreamFilters?: string;
  /** label names already used by other filters */
  excludeLabels: Set<string>;
  /** query expression from the editor to scope stream filter results */
  queryExpr?: string;
  onChange: (filter: StreamFilterState) => void;
  onRemove: () => void;
  onRunQuery: () => void;
}

const StreamFilterRow = ({
  datasource,
  filter,
  timeRange,
  extraStreamFilters,
  excludeLabels,
  queryExpr,
  onChange,
  onRemove,
  onRunQuery,
}: Props) => {
  const { loadStreamFieldNames, loadStreamFieldValues } = useFetchStreamFilters({
    datasource,
    fieldName: filter.label,
    timeRange,
    queryExpr,
    extraStreamFilters,
    excludeLabels,
  });

  const { withVariables, filterSelection } = useTemplateVariables();

  const handleSelectLabel = useCallback(
    (option: { value?: string; label?: string } | null) => {
      if (!option || !option.value) {
        return;
      }
      // When label changes, reset values
      onChange({ ...filter, label: option.value, values: [] });
    },
    [onChange, filter]
  );

  const handleSelectOperator = useCallback(
    (option: SelectableValue<StreamFilterOperator>) => {
      if (option.value) {
        onChange({ ...filter, operator: option.value });
        if (filter.label && filter.values.length > 0) {
          onRunQuery();
        }
      }
    },
    [onChange, filter, onRunQuery]
  );

  const selectedValues = useMemo<ComboboxOption[]>(() => {
    return filter.values.map((v) => ({ label: v, value: v }));
  }, [filter.values]);

  const handleSelectValues = useCallback(
    (selected: ComboboxOption[]) => {
      const values = selected.map((s) => s.value).filter((v): v is string => v !== undefined && v !== '');
      const newValues = filterSelection(values);
      onChange({ ...filter, values: newValues });
      if (filter.label && newValues.length > 0) {
        onRunQuery();
      }
    },
    [onChange, filter, onRunQuery, filterSelection]
  );

  const loadValuesOptions = useCallback(
    (inputValue: string): Promise<ComboboxOption[]> => {
      return loadStreamFieldValues(inputValue).then((options) => {
        const filtered = options
          .filter((opt) => opt.value !== '')
          .map((opt) => ({
            label: opt.label,
            value: opt.value,
            description: opt.description,
          }));
        return withVariables(filtered, inputValue);
      });
    },
    [loadStreamFieldValues, withVariables]
  );

  const labelValue = useMemo(() => {
    return filter.label ? { label: filter.label, value: filter.label } : null;
  }, [filter.label]);

  return (
    <StepRowLayout onDelete={onRemove}>
      <CompatibleCombobox
        placeholder='Select stream label'
        value={labelValue}
        options={loadStreamFieldNames}
        onChange={handleSelectLabel}
        width={'auto'}
        minWidth={10}
      />
      <CompatibleCombobox<StreamFilterOperator>
        options={OPERATOR_OPTIONS}
        value={filter.operator || 'in'}
        onChange={handleSelectOperator}
        width={'auto'}
        minWidth={2}
      />
      <CompatibleMultiCombobox
        key={filter.label}
        placeholder='Select values'
        value={selectedValues}
        options={loadValuesOptions}
        onChange={handleSelectValues}
        isClearable
        minWidth={20}
        width={'auto'}
      />
    </StepRowLayout>
  );
};

export default StreamFilterRow;
