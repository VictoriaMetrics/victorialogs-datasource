import { css } from '@emotion/css';
import React, { memo, useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { useTemplateVariables } from '../../../../../hooks/useTemplateVariables';
import { CompatibleMultiCombobox } from '../../../../CompatibleMultiCombobox';

import OptionalField from './OptionalField';
import { useFieldFetch } from './useFieldFetch';
import { useOptionalField } from './useOptionalField';

export interface PackJsonEditorRow {
  fieldList?: string[];
  resultField?: string;
}

interface Props<TRow extends PackJsonEditorRow> {
  row: TRow;
  onChange: (updatedRow: TRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext?: string;
}

function PackJsonEditorInner<TRow extends PackJsonEditorRow>({ row, onChange, datasource, timeRange, queryContext }: Props<TRow>) {
  const styles = useStyles2(getStyles);
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext });
  const { filterSelection } = useTemplateVariables();

  const selectedFields = useMemo(
    () => (row.fieldList ?? []).map((f) => ({ label: f, value: f })),
    [row.fieldList]
  );

  const handleFieldsChange = useCallback(
    (selected: Array<{ value?: string; label?: string }>) => {
      onChange({ ...row, fieldList: filterSelection(selected.map((s) => s.value ?? '').filter(Boolean)) });
    },
    [onChange, row, filterSelection]
  );

  // Fields is optional - when undefined, all fields are packed
  const isFieldsActive = row.fieldList !== undefined;

  const handleAddFields = useCallback(() => {
    onChange({ ...row, fieldList: [] });
  }, [onChange, row]);

  const handleRemoveFields = useCallback(() => {
    onChange({ ...row, fieldList: undefined });
  }, [onChange, row]);

  const resultField = useOptionalField(row.resultField, useCallback((v) => onChange({ ...row, resultField: v }), [onChange, row]));

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
      <OptionalField label='as' isActive={resultField.isActive} onAdd={resultField.handleAdd} onRemove={resultField.handleRemove}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>as</span>
          <AutoSizeInput
            placeholder='result field'
            defaultValue={row.resultField ?? ''}
            minWidth={10}
            onCommitChange={resultField.handleChange}
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
