import React, { memo, useCallback } from 'react';

import { AutoSizeInput } from '@grafana/ui';

import { FilterRowContentProps } from './StandardFilterContent';

const CustomPipeContent = memo<FilterRowContentProps>(function CustomPipeContent({ row, onChange }) {
  const handleCommit = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => onChange({ ...row, values: [e.currentTarget.value] }),
    [onChange, row]
  );

  return (
    <AutoSizeInput
      defaultValue={row.values[0] ?? ''}
      minWidth={20}
      placeholder='Custom value'
      onCommitChange={handleCommit}
    />
  );
});

export default CustomPipeContent;
