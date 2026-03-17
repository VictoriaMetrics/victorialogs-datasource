import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import FieldNameSelect from '../../shared/FieldNameSelect';
import IfFilterInput from '../../shared/IfFilterInput';
import OptionalField from '../../shared/OptionalField';
import { ModifyRowContentProps } from '../modifyTypeConfig';

const ReplaceEditor = memo(function ReplaceEditor({ row, onChange, datasource, timeRange, queryContext }: ModifyRowContentProps) {
  const styles = useStyles2(getStyles);

  const handleOldChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, oldValue: e.currentTarget.value }),
    [onChange, row]
  );

  const handleNewChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, newValue: e.currentTarget.value }),
    [onChange, row]
  );

  const handleAtFieldChange = useCallback((value: string) => onChange({ ...row, atField: value }), [onChange, row]);

  const handleLimitChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, limit: e.currentTarget.value }),
    [onChange, row]
  );

  const handleIfFilterChange = useCallback(
    (value: string | undefined) => onChange({ ...row, ifFilter: value }),
    [onChange, row]
  );

  const isLimitActive = row.limit !== undefined;

  const handleAddLimit = useCallback(() => {
    onChange({ ...row, limit: '' });
  }, [onChange, row]);

  const handleRemoveLimit = useCallback(() => {
    onChange({ ...row, limit: undefined });
  }, [onChange, row]);

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <span className={styles.label}>(</span>
      <AutoSizeInput
        placeholder='old'
        defaultValue={row.oldValue ?? ''}
        minWidth={8}
        onCommitChange={handleOldChange}
      />
      <span className={styles.label}>,</span>
      <AutoSizeInput
        placeholder='new'
        defaultValue={row.newValue ?? ''}
        minWidth={8}
        onCommitChange={handleNewChange}
      />
      <span className={styles.label}>)</span>
      <span className={styles.label}>at</span>
      <FieldNameSelect
        value={row.atField ?? ''}
        onChange={handleAtFieldChange}
        datasource={datasource}
        timeRange={timeRange}
        queryContext={queryContext}
      />
      <OptionalField label='limit' isActive={isLimitActive} onAdd={handleAddLimit} onRemove={handleRemoveLimit}>
        <Stack direction='row' gap={0.5} alignItems='center'>
          <span className={styles.label}>limit</span>
          <AutoSizeInput
            placeholder='N'
            defaultValue={row.limit ?? ''}
            minWidth={4}
            onCommitChange={handleLimitChange}
          />
        </Stack>
      </OptionalField>
    </Stack>
  );
});

export default ReplaceEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
