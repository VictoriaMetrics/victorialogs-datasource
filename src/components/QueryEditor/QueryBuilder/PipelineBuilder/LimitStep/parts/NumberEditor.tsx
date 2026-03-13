import React, { memo, useCallback } from 'react';

import { AutoSizeInput, Stack } from '@grafana/ui';

import { LimitRowContentProps } from '../limitTypeConfig';

const NumberEditor = memo(function NumberEditor({ row, onChange }: LimitRowContentProps) {
  const handleCountChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...row, count: e.currentTarget.value });
    },
    [onChange, row]
  );

  return (
    <Stack direction='row' gap={0.5} alignItems='center'>
      <AutoSizeInput
        placeholder='N'
        defaultValue={row.count ?? ''}
        minWidth={6}
        onCommitChange={handleCountChange}
      />
    </Stack>
  );
});

export default NumberEditor;
