import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AutoSizeInput, Stack, useStyles2 } from '@grafana/ui';

import FieldNameSelect from '../../shared/FieldNameSelect';
import IfFilterInput from '../../shared/IfFilterInput';
import ResultFlagSelect from '../../shared/ResultFlagSelect';
import { ModifyRowContentProps } from '../modifyTypeConfig';

const ExtractEditor = memo(function ExtractEditor({ row, onChange, datasource, timeRange }: ModifyRowContentProps) {
  const styles = useStyles2(getStyles);

  const handlePatternChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, pattern: e.currentTarget.value }),
    [onChange, row]
  );

  const handleFromFieldChange = useCallback((value: string) => onChange({ ...row, fromField: value }), [onChange, row]);

  const handleIfFilterChange = useCallback(
    (value: string | undefined) => onChange({ ...row, ifFilter: value }),
    [onChange, row]
  );

  const handleFlagChange = useCallback(
    (keepOriginalFields: boolean | undefined, skipEmptyResults: boolean | undefined) =>
      onChange({ ...row, keepOriginalFields, skipEmptyResults }),
    [onChange, row]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <AutoSizeInput
        placeholder='pattern'
        defaultValue={row.pattern ?? ''}
        minWidth={12}
        onCommitChange={handlePatternChange}
      />
      <span className={styles.label}>from</span>
      <FieldNameSelect
        value={row.fromField ?? '_msg'}
        onChange={handleFromFieldChange}
        datasource={datasource}
        timeRange={timeRange}
      />
      <ResultFlagSelect
        keepOriginalFields={row.keepOriginalFields}
        skipEmptyResults={row.skipEmptyResults}
        onChange={handleFlagChange}
      />
    </Stack>
  );
});

export default ExtractEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
