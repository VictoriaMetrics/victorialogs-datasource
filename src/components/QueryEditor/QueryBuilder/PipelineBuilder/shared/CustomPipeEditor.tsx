import React, { memo, useCallback } from 'react';

import { AutoSizeInput } from '@grafana/ui';

interface Props<TRow extends { expression?: string }> {
  row: TRow;
  onChange: (row: TRow) => void;
}

function CustomPipeEditorInner<TRow extends { expression?: string }>({ row, onChange }: Props<TRow>) {
  const handleCommit = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...row, expression: e.currentTarget.value });
    },
    [row, onChange]
  );

  return (
    <AutoSizeInput
      defaultValue={row.expression ?? ''}
      minWidth={20}
      placeholder='custom expression'
      onCommitChange={handleCommit}
    />
  );
}

const CustomPipeEditor = memo(CustomPipeEditorInner) as typeof CustomPipeEditorInner;

export default CustomPipeEditor;
