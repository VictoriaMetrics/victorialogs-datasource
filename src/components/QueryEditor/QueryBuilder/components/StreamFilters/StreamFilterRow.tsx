import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue, TimeRange } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { ComboboxOption, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { FilterFieldType, StreamFilterOperator, StreamFilterState } from '../../../../../types';
import { CompatibleCombobox } from '../../../../CompatibleCombobox';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';

import { useFetchStreamFilters } from './useFetchStreamFilters';

const OPERATOR_OPTIONS: ComboboxOption<StreamFilterOperator>[] = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
];

const isVariable = (v: string) => v.startsWith('$');

interface Props {
  datasource: VictoriaLogsDatasource;
  filter: StreamFilterState;
  timeRange?: TimeRange;
  /** extra_stream_filters built from preceding filters */
  extraStreamFilters?: string;
  /** label names already used by other filters */
  excludeLabels: Set<string>;
  onChange: (filter: StreamFilterState) => void;
  onRemove: () => void;
}

const StreamFilterRow = ({
  datasource,
  filter,
  timeRange,
  extraStreamFilters,
  excludeLabels,
  onChange,
  onRemove,
}: Props) => {
  const styles = useStyles2(getStyles);

  const { loadStreamFieldNames, loadStreamFieldValues } = useFetchStreamFilters({
    datasource,
    fieldName: filter.label,
    timeRange,
    extraStreamFilters,
    excludeLabels,
  });

  /** Dashboard variables of type fieldValue — shown at the top of the values dropdown */
  const templateVariables = useMemo<ComboboxOption[]>(() => {
    return getTemplateSrv()
      .getVariables()
      .filter((v) => v.type === 'query' && (v as any).query?.type === FilterFieldType.FieldValue)
      .map((v) => ({
        label: `$${v.name}`,
        value: `$${v.name}`,
        description: v.label || v.name,
      }));
  }, []);

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
      }
    },
    [onChange, filter]
  );

  const selectedValues = useMemo<ComboboxOption[]>(() => {
    return filter.values.map((v) => ({ label: v, value: v }));
  }, [filter.values]);

  const handleSelectValues = useCallback(
    (selected: ComboboxOption[]) => {
      const values = selected
        .map((s) => s.value)
        .filter((v): v is string => v !== undefined && v !== '');

      // If the last added value is a variable — keep only that variable (single variable mode)
      const lastSelected = values[values.length - 1];
      if (lastSelected && isVariable(lastSelected)) {
        onChange({ ...filter, values: [lastSelected] });
        return;
      }

      // Otherwise strip any variables from the selection (regular multi-value mode)
      onChange({ ...filter, values: values.filter((v) => !isVariable(v)) });
    },
    [onChange, filter]
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
        // Prepend template variables at the top of the list
        return [...templateVariables, ...filtered];
      });
    },
    [loadStreamFieldValues, templateVariables]
  );

  const labelValue = useMemo(() => {
    return filter.label ? { label: filter.label, value: filter.label } : null;
  },[filter.label]);

  return (
    <div className={styles.wrapper}>
      <Stack direction={'row'} gap={0.5} alignItems={'center'} justifyContent={'flex-start'}>
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
          value={filter.operator || '='}
          onChange={handleSelectOperator}
          width={8}
        />
        <CompatibleMultiCombobox
          key={filter.label}
          placeholder='Select values'
          value={selectedValues}
          options={loadValuesOptions}
          onChange={handleSelectValues}
          isClearable
          minWidth={25}
          width={'auto'}
        />
        <div className={styles.actions}>
          <IconButton name={'times'} tooltip={'Remove stream filter'} size='sm' onClick={onRemove} />
        </div>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: grid;
      gap: ${theme.spacing(0.5)};
      width: max-content;
      border: 1px solid ${theme.colors.border.strong};
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1)};
    `,
    header: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
    `,
    actions: css`
      margin-left: ${theme.spacing(0.5)};
      display: flex;
      align-items: center;
      gap: ${theme.spacing(0.5)};
    `,
  };
};

export default StreamFilterRow;
