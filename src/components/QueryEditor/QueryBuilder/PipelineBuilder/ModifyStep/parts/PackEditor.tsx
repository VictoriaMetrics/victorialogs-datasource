import { css } from '@emotion/css';
import React, { memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import { CompatibleMultiCombobox } from '../../../../../CompatibleMultiCombobox';
import { useFilterFetch } from '../../FilterStep/useFilterFetch';
import { ModifyRowContentProps } from '../modifyTypeConfig';

import OptionalField from './OptionalField';

const PackEditor = memo(function PackEditor({ row, onChange, datasource, timeRange }: ModifyRowContentProps) {
  const styles = useStyles2(getStyles);
  const { loadFieldNames } = useFilterFetch({ datasource, timeRange });
  const fields = row.fieldList ?? [];

  const selectedFields = useMemo(() => fields.map((f) => ({ label: f, value: f })), [fields]);

  const handleFieldsChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onChange({ ...row, fieldList: selected.map((s) => s.value ?? '').filter(Boolean) });
    },
    [onChange, row]
  );

  const handleResultFieldChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, resultField: e.currentTarget.value }),
    [onChange, row]
  );

  // Fields is optional - when undefined, all fields are packed
  const isFieldsActive = row.fieldList !== undefined;

  const handleAddFields = useCallback(() => {
    onChange({ ...row, fieldList: [] });
  }, [onChange, row]);

  const handleRemoveFields = useCallback(() => {
    onChange({ ...row, fieldList: undefined });
  }, [onChange, row]);

  // As is optional - when undefined, defaults to _msg
  const isAsActive = row.resultField !== undefined;

  const handleAddAs = useCallback(() => {
    onChange({ ...row, resultField: '' });
  }, [onChange, row]);

  const handleRemoveAs = useCallback(() => {
    onChange({ ...row, resultField: undefined });
  }, [onChange, row]);

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <OptionalField label='fields' isActive={isFieldsActive} onAdd={handleAddFields} onRemove={handleRemoveFields}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>fields (</span>
          <CompatibleMultiCombobox
            placeholder='Select fields'
            value={selectedFields}
            options={loadFieldNames}
            onChange={handleFieldsChange}
            width='auto'
            minWidth={16}
            createCustomValue
          />
          <span className={styles.label}>)</span>
        </Stack>
      </OptionalField>
      <OptionalField label='as' isActive={isAsActive} onAdd={handleAddAs} onRemove={handleRemoveAs}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>as</span>
          <AutoSizeInput
            placeholder='result field'
            defaultValue={row.resultField ?? ''}
            minWidth={10}
            onCommitChange={handleResultFieldChange}
          />
        </Stack>
      </OptionalField>
    </Stack>
  );
});

export default PackEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
