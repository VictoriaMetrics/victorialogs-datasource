import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Button, IconButton, Stack, useStyles2 } from '@grafana/ui';

import FieldNameSelect from '../../shared/FieldNameSelect';
import IfFilterInput from '../../shared/IfFilterInput';
import OptionalField from '../../shared/OptionalField';
import ResultFlagSelect from '../../shared/ResultFlagSelect';
import { ModifyRowContentProps } from '../modifyTypeConfig';

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
    onChange({ ...row, fieldList: [''] });
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
      <span className={styles.label}>fields (</span>
      <OptionalField label='fields' isActive={isFieldsActive} onAdd={handleAddFields} onRemove={handleRemoveFields}>
        <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
          {fields.map((field, index) => (
            <Stack key={index} direction='row' gap={0} alignItems='center'>
              <div className={styles.inputNoRightRadius}>
                <AutoSizeInput
                  placeholder='field name'
                  defaultValue={field}
                  minWidth={10}
                  onCommitChange={(e) => handleFieldChange(index, e.currentTarget.value)}
                />
              </div>
              <div className={styles.removeButtonContainer}>
                <IconButton className={styles.removeButton} name='times' size='sm' tooltip='Remove field' onClick={() => handleRemoveField(index)} />
              </div>
              <span>,</span>
            </Stack>
          ))}
          <Button variant='secondary' size='sm' icon='plus' onClick={handleAddField}>Add field</Button>
        </Stack>
      </OptionalField>
      <span className={styles.label}>)</span>
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
  inputNoRightRadius: css`
    & * {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
  `,
  removeButtonContainer: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    width: 23px;
    border: 1px solid ${theme.colors.border.medium};
    border-left: none;
    border-radius: 0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0;
  `,
  removeButton: css`
    margin: 0;
    width: 100%;
    height: 100%;
    &::before {
      width: 100%;
      height: 100%;
      border-radius: 0;
    }
  `,
});
