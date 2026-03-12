import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import { ModifyRowContentProps } from '../modifyTypeConfig';

import IfFilterInput from './IfFilterInput';
import OptionalField from './OptionalField';
import ResultFlagSelect from './ResultFlagSelect';

const FormatEditor = memo(function FormatEditor({ row, onChange }: ModifyRowContentProps) {
  const styles = useStyles2(getStyles);

  const handleFormatChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, formatString: e.currentTarget.value }),
    [onChange, row]
  );

  const handleResultFieldChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, resultField: e.currentTarget.value }),
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

  const isAsActive = row.resultField !== undefined;

  const handleAddAs = useCallback(() => {
    onChange({ ...row, resultField: '' });
  }, [onChange, row]);

  const handleRemoveAs = useCallback(() => {
    onChange({ ...row, resultField: undefined });
  }, [onChange, row]);

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <AutoSizeInput
        placeholder='format string'
        defaultValue={row.formatString ?? ''}
        minWidth={12}
        onCommitChange={handleFormatChange}
      />
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
