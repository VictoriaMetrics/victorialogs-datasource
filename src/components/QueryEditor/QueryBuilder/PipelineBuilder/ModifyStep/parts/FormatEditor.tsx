import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';


import IfFilterInput from '../../shared/IfFilterInput';
import OptionalField from '../../shared/OptionalField';
import ResultFlagSelect from '../../shared/ResultFlagSelect';
import { useOptionalField } from '../../shared/useOptionalField';
import { ModifyRowContentProps } from '../modifyTypeConfig';

const FormatEditor = memo(function FormatEditor({ row, onChange }: ModifyRowContentProps) {
  const styles = useStyles2(getStyles);

  const handleFormatChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, formatString: e.currentTarget.value }),
    [onChange, row]
  );

  const handleIfFilterChange = useCallback(
    (value: string | undefined) => onChange({ ...row, ifFilter: value }),
    [onChange, row]
  );

  const handleFlagChange = useCallback(
    (keepOriginalFields: boolean | undefined, skipEmptyResults: boolean | undefined) =>
      onChange({ ...row, keepOriginalFields, skipEmptyResults }),
    [onChange, row]
  );

  const resultField = useOptionalField(row.resultField, useCallback((v) => onChange({ ...row, resultField: v }), [onChange, row]));

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <AutoSizeInput
        placeholder='format string'
        defaultValue={row.formatString ?? ''}
        minWidth={12}
        onCommitChange={handleFormatChange}
      />
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
      <ResultFlagSelect
        keepOriginalFields={row.keepOriginalFields}
        skipEmptyResults={row.skipEmptyResults}
        onChange={handleFlagChange}
      />
    </Stack>
  );
});

export default FormatEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
