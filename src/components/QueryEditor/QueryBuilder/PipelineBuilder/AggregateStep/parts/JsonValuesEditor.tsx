import { css } from '@emotion/css';
import React, { memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import { CompatibleCombobox } from '../../../../../CompatibleCombobox';
import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import IfFilterInput from '../../shared/IfFilterInput';
import OptionalField from '../../shared/OptionalField';
import { useFieldFetch } from '../../shared/useFieldFetch';
import { AggregateRowContentProps } from '../aggregateTypeConfig';

const SORT_DIRECTION_OPTIONS = [
  { label: 'asc', value: 'asc' },
  { label: 'desc', value: 'desc' },
];

const JsonValuesEditor = memo(function JsonValuesEditor({
  row,
  onChange,
  datasource,
  timeRange,
}: AggregateRowContentProps) {
  const styles = useStyles2(getStyles);
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange });

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

  // Limit
  const isLimitActive = row.limit !== undefined;
  const handleAddLimit = useCallback(() => onChange({ ...row, limit: '' }), [onChange, row]);
  const handleRemoveLimit = useCallback(() => onChange({ ...row, limit: undefined }), [onChange, row]);
  const handleLimitChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, limit: e.currentTarget.value }),
    [onChange, row]
  );

  // Sort
  const isSortActive = row.sortField !== undefined;
  const handleAddSort = useCallback(
    () => onChange({ ...row, sortField: '', sortDirection: 'asc' }),
    [onChange, row]
  );
  const handleRemoveSort = useCallback(
    () => onChange({ ...row, sortField: undefined, sortDirection: undefined }),
    [onChange, row]
  );

  const handleSortFieldChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, sortField: e.currentTarget.value }),
    [onChange, row]
  );

  const sortDirectionValue = useMemo(
    () => (row.sortDirection ? { label: row.sortDirection, value: row.sortDirection } : null),
    [row.sortDirection]
  );

  const handleSortDirectionChange = useCallback(
    (option: { value?: string; label?: string } | null) => {
      if (option?.value) {
        onChange({ ...row, sortDirection: option.value });
      }
    },
    [onChange, row]
  );

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
      <OptionalField label='limit' isActive={isLimitActive} onAdd={handleAddLimit} onRemove={handleRemoveLimit}>
        <AutoSizeInput
          placeholder='N'
          defaultValue={row.limit ?? ''}
          minWidth={4}
          onCommitChange={handleLimitChange}
        />
      </OptionalField>
      <OptionalField label='sort by' isActive={isSortActive} onAdd={handleAddSort} onRemove={handleRemoveSort}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>sort by</span>
          <AutoSizeInput
            placeholder='field'
            defaultValue={row.sortField ?? ''}
            minWidth={8}
            onCommitChange={handleSortFieldChange}
          />
          <CompatibleCombobox
            placeholder='direction'
            value={sortDirectionValue}
            options={SORT_DIRECTION_OPTIONS}
            onChange={handleSortDirectionChange}
            width='auto'
            minWidth={8}
          />
        </Stack>
      </OptionalField>
    </Stack>
  );
});

export default JsonValuesEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
