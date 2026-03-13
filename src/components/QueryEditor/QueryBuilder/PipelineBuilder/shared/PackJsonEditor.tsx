import { css } from '@emotion/css';
import React, { memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';

import OptionalField from './OptionalField';
import { useFieldFetch } from './useFieldFetch';

export interface PackJsonEditorRow {
  fieldList?: string[];
  resultField?: string;
}

interface Props<TRow extends PackJsonEditorRow> {
  row: TRow;
  onChange: (updatedRow: TRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
}

function PackJsonEditorInner<TRow extends PackJsonEditorRow>({ row, onChange, datasource, timeRange }: Props<TRow>) {
  const styles = useStyles2(getStyles);
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange });

  const selectedFields = useMemo(
    () => (row.fieldList ?? []).map((f) => ({ label: f, value: f })),
    [row.fieldList]
  );

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
      <span className={styles.label}>fields (</span>
      <OptionalField label='fields' isActive={isFieldsActive} onAdd={handleAddFields} onRemove={handleRemoveFields}>
        <Stack direction='row' gap={0.5} alignItems='center'>
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
      </OptionalField>
      <span className={styles.label}>)</span>
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
}

const PackJsonEditor = memo(PackJsonEditorInner) as typeof PackJsonEditorInner;

export default PackJsonEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
