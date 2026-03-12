import React, { memo, useCallback } from 'react';

import { AutoSizeInput } from '@grafana/ui';

import OptionalField from './OptionalField';

interface Props {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

const IfFilterInput = memo(function IfFilterInput({ value, onChange }: Props) {
  const isActive = value !== undefined;

  const handleCommit = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onChange(e.currentTarget.value);
    },
    [onChange]
  );

  const handleAdd = useCallback(() => {
    onChange('');
  }, [onChange]);

  const handleRemove = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  return (
    <OptionalField label='if' isActive={isActive} onAdd={handleAdd} onRemove={handleRemove}>
      <AutoSizeInput
        placeholder='if condition'
        defaultValue={value ?? ''}
        minWidth={12}
        onCommitChange={handleCommit}
      />
    </OptionalField>
  );
});

export default IfFilterInput;
