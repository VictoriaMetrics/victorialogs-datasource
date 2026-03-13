import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';

import FieldNameSelect from '../../shared/FieldNameSelect';
import IfFilterInput from '../../shared/IfFilterInput';
import { AggregateRowContentProps } from '../aggregateTypeConfig';

const TwoFieldEditor = memo(function TwoFieldEditor({ row, onChange, datasource, timeRange }: AggregateRowContentProps) {
  const styles = useStyles2(getStyles);

  const handleReferenceFieldChange = useCallback(
    (value: string) => onChange({ ...row, referenceField: value }),
    [onChange, row]
  );

  const handleFieldListChange = useCallback(
    (value: string) => onChange({ ...row, fieldList: value ? [value] : [] }),
    [onChange, row]
  );

  const handleIfFilterChange = useCallback(
    (value: string | undefined) => onChange({ ...row, ifFilter: value }),
    [onChange, row]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center' wrap='wrap'>
      <IfFilterInput value={row.ifFilter} onChange={handleIfFilterChange} />
      <span className={styles.label}>(</span>
      <FieldNameSelect
        value={row.referenceField ?? ''}
        onChange={handleReferenceFieldChange}
        datasource={datasource}
        timeRange={timeRange}
      />
      <span className={styles.label}>,</span>
      <FieldNameSelect
        value={row.fieldList?.[0] ?? ''}
        onChange={handleFieldListChange}
        datasource={datasource}
        timeRange={timeRange}
      />
      <span className={styles.label}>)</span>
    </Stack>
  );
});

export default TwoFieldEditor;

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
