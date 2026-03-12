import React, { memo, useCallback, useMemo } from 'react';

import { CompatibleCombobox } from '../../../../CompatibleCombobox';

import OptionalField from './OptionalField';

const FLAG_OPTIONS = [
  { label: 'keep_original_fields', value: 'keep_original_fields' },
  { label: 'skip_empty_results', value: 'skip_empty_results' },
];

interface Props {
  keepOriginalFields?: boolean;
  skipEmptyResults?: boolean;
  onChange: (keepOriginalFields: boolean | undefined, skipEmptyResults: boolean | undefined) => void;
}

const ResultFlagSelect = memo(function ResultFlagSelect({ keepOriginalFields, skipEmptyResults, onChange }: Props) {
  const isActive = keepOriginalFields !== undefined || skipEmptyResults !== undefined;

  const currentValue = useMemo(() => {
    if (keepOriginalFields) {
      return { label: 'keep_original_fields', value: 'keep_original_fields' };
    }
    if (skipEmptyResults) {
      return { label: 'skip_empty_results', value: 'skip_empty_results' };
    }
    return { label: 'keep_original_fields', value: 'keep_original_fields' };
  }, [keepOriginalFields, skipEmptyResults]);

  const handleChange = useCallback(
    (option: { value?: string } | null) => {
      const val = option?.value ?? '';
      onChange(val === 'keep_original_fields', val === 'skip_empty_results');
    },
    [onChange]
  );

  const handleAdd = useCallback(() => {
    onChange(false, false);
  }, [onChange]);

  const handleRemove = useCallback(() => {
    onChange(undefined, undefined);
  }, [onChange]);

  return (
    <OptionalField label='options' isActive={isActive} onAdd={handleAdd} onRemove={handleRemove}>
      <CompatibleCombobox
        placeholder='Result flag'
        value={currentValue}
        options={FLAG_OPTIONS}
        onChange={handleChange}
        width='auto'
        minWidth={12}
      />
    </OptionalField>
  );
});

export default ResultFlagSelect;
