import React, { memo, useMemo } from 'react';

import { CompatibleCombobox } from '../../../../../CompatibleCombobox';

import { OperatorComponentProps } from './StaticOperatorLabel';

interface OperatorOption {
  label: string;
  value: string;
}

export const createOperatorSelect = (options: OperatorOption[]) => {
  const Component = memo<OperatorComponentProps>(({ value, onChange }) => {
    const selected = useMemo(() => options.find((o) => o.value === value) ?? options[0], [value]);

    const handleChange = (option: { value?: string } | null) => {
      if (option?.value) {
        onChange(option.value);
      }
    };

    return <CompatibleCombobox options={options} value={selected} onChange={handleChange} width='auto' minWidth={4} />;
  });

  Component.displayName = 'OperatorSelect';

  return Component;
};
