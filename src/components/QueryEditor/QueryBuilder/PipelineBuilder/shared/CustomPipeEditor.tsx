import React, { memo, useCallback } from 'react';

import { AutoSizeInput } from '@grafana/ui';

interface Row {
  expression?: string;
}

interface Props {
  row: Row;
  onChange: (row: never) => void;
}

const CustomPipeEditor = memo<Props>(({ row, onChange }) => {
  const handleCommit = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...row, expression: e.currentTarget.value } as never);
    },
    [row, onChange]
  );

  return (
    <AutoSizeInput
      defaultValue={row.expression ?? ''}
      minWidth={20}
      placeholder='Custom value'
      onCommitChange={handleCommit}
    />
  );
});

CustomPipeEditor.displayName = 'CustomPipeEditor';

export default CustomPipeEditor;
