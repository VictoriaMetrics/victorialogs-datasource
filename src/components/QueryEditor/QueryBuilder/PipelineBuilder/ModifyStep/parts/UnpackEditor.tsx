import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, IconButton, Stack, useStyles2 } from '@grafana/ui';

import FieldNameSelect from '../../FilterStep/parts/FieldNameSelect';
import { ModifyRowContentProps } from '../modifyTypeConfig';

import IfFilterInput from './IfFilterInput';
import OptionalField from './OptionalField';
import ResultFlagSelect from './ResultFlagSelect';

const UnpackEditor = memo(function UnpackEditor({ row, onChange, datasource, timeRange }: ModifyRowContentProps) {
  const styles = useStyles2(getStyles);
  const fields = row.fieldList ?? [];

  const handleFromFieldChange = useCallback((value: string) => onChange({ ...row, fromField: value }), [onChange, row]);

  const handleIfFilterChange = useCallback(
    (value: string | undefined) => onChange({ ...row, ifFilter: value }),
    [onChange, row]
  );

  const handlePrefixChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, resultPrefix: e.currentTarget.value }),
    [onChange, row]
  );

  const handleFlagChange = useCallback(
    (keepOriginalFields: boolean | undefined, skipEmptyResults: boolean | undefined) =>
      onChange({ ...row, keepOriginalFields, skipEmptyResults }),
    [onChange, row]
  );

  // Fields is optional - when undefined, all fields are unpacked
  const isFieldsActive = row.fieldList !== undefined;

  const handleAddFields = useCallback(() => {
    onChange({ ...row, fieldList: [] });
  }, [onChange, row]);

  const handleRemoveFields = useCallback(() => {
    onChange({ ...row, fieldList: undefined });
  }, [onChange, row]);

  const handleAddField = useCallback(() => {
    onChange({ ...row, fieldList: [...fields, ''] });
  }, [fields, onChange, row]);

  const handleRemoveField = useCallback(
    (index: number) => {
      onChange({ ...row, fieldList: fields.filter((_, i) => i !== index) });
    },
    [fields, onChange, row]
  );

  const handleFieldChange = useCallback(
    (index: number, value: string) => {
      const newFields = [...fields];
      newFields[index] = value;
      onChange({ ...row, fieldList: newFields });
    },
    [fields, onChange, row]
  );

  // Result prefix is optional
  const isPrefixActive = row.resultPrefix !== undefined;

  const handleAddPrefix = useCallback(() => {
    onChange({ ...row, resultPrefix: '' });
  }, [onChange, row]);

  const handleRemovePrefix = useCallback(() => {
    onChange({ ...row, resultPrefix: undefined });
  }, [onChange, row]);

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <span className={styles.label}>from</span>
      <FieldNameSelect
        value={row.fromField ?? '_msg'}
        onChange={handleFromFieldChange}
        datasource={datasource}
        timeRange={timeRange}
      />
      <OptionalField label='fields' isActive={isFieldsActive} onAdd={handleAddFields} onRemove={handleRemoveFields}>
        <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
          <span className={styles.label}>fields (</span>
          {fields.map((field, index) => (
            <Stack key={index} direction='row' gap={0} alignItems='center'>
              <AutoSizeInput
                placeholder='field name'
                defaultValue={field}
                minWidth={10}
                onCommitChange={(e) => handleFieldChange(index, e.currentTarget.value)}
              />
              <IconButton name='times' size='sm' tooltip='Remove field' onClick={() => handleRemoveField(index)} />
            </Stack>
          ))}
          <IconButton name='plus' size='sm' tooltip='Add field' onClick={handleAddField} />
          <span className={styles.label}>)</span>
        </Stack>
      </OptionalField>
      <OptionalField
        label='result_prefix'
        isActive={isPrefixActive}
        onAdd={handleAddPrefix}
        onRemove={handleRemovePrefix}
      >
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>result_prefix</span>
          <AutoSizeInput
            placeholder='prefix'
            defaultValue={row.resultPrefix ?? ''}
            minWidth={8}
            onCommitChange={handlePrefixChange}
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

export default UnpackEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
