import React, { memo, useCallback } from 'react';

import { Stack } from '@grafana/ui';

import FieldNameSelect from '../../shared/FieldNameSelect';
import IfFilterInput from '../../shared/IfFilterInput';
import { AggregateRowContentProps } from '../aggregateTypeConfig';

const SingleFieldEditor = memo(function SingleFieldEditor({
  row,
  onChange,
  datasource,
  timeRange,
}: AggregateRowContentProps) {
  const handleFieldChange = useCallback(
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
      <FieldNameSelect
        value={row.fieldList?.[0] ?? ''}
        onChange={handleFieldChange}
        datasource={datasource}
        timeRange={timeRange}
      />
    </Stack>
  );
});

export default SingleFieldEditor;
