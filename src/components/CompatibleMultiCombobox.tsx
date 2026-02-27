import React, { useCallback, useMemo } from 'react';

import { AsyncMultiSelect, ComboboxOption, MultiCombobox, MultiSelect, SelectValue } from '@grafana/ui';

const isComboboxOption = (option: unknown): option is ComboboxOption => {
  return Boolean(option && typeof option === 'object' && 'value' in option && option.value !== undefined);
};

const isComboboxSelectedValue = (option: unknown): option is ComboboxOption[] => {
  return Boolean(option && Array.isArray(option) && option.every(isComboboxOption));
};

/**
 * A compatibility wrapper for multi select that uses Combobox in Grafana 11+
 * and Select in older versions.
 */
export const CompatibleMultiCombobox: typeof MultiCombobox = (props) => {
  // Normalize value to Select format
  const normalizedValue = useMemo<SelectValue<any>[] | undefined>(() => {
    const selectedValue = props.value;
    if (isComboboxSelectedValue(selectedValue)) {
      return selectedValue.map(v => ({ value: v.value, label: v.label }));
    }
    return props.value;
  }, [props.value]);


  const handleSelectChange = (selected: SelectValue<any>[] | null) => {
    props.onChange(selected?.map((s) => ({ value: s.value, label: s.label ?? s.value })) ?? []);
  };

  const asyncOption = useCallback((value: SelectValue<any>) => {
    if (typeof props.options === 'function') {
      return props.options(value);
    }
    return new Promise<SelectValue<any>[]>(() => {});
  }, [props]);

  const selectOptions = useMemo(() => {
    if (Array.isArray(props.options)) {
      return props.options.map<SelectValue<any>>((opt) => ({
        value: opt.value,
        label: opt.label,
        description: opt.description,
      }));
    }

    return asyncOption;
  }, [asyncOption, props.options]);

  if (MultiCombobox) {
    return (
      <MultiCombobox {...props} />
    );
  }

  if (typeof selectOptions === 'function') {
    return (
      <AsyncMultiSelect
        placeholder={props.placeholder}
        width={props.width}
        value={normalizedValue}
        loadOptions={selectOptions}
        defaultOptions
        allowCustomValue={props.createCustomValue}
        onChange={handleSelectChange}
        isClearable={props.isClearable}
        isLoading={props.loading}
        disabled={props.disabled}
      />
    );
  }

  return (
    <MultiSelect
      placeholder={props.placeholder}
      width={props.width}
      value={normalizedValue}
      options={selectOptions}
      allowCustomValue={props.createCustomValue}
      onChange={handleSelectChange}
      isClearable={props.isClearable}
      isLoading={props.loading}
      disabled={props.disabled}
    />
  );
};
