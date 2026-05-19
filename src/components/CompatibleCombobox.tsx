import React, { useCallback, useMemo } from 'react';

import { AsyncSelect, Combobox, Select, SelectValue } from '@grafana/ui';

/**
 * A compatibility wrapper for static select that uses Combobox in Grafana 11+
 * and Select in older versions.
 */
export const CompatibleCombobox: typeof Combobox = (props) => {
  // Normalize value to Select format
  const normalizedValue = useMemo<SelectValue<any>>(() => {
    if (!props.value) {
      return null;
    }
    if (typeof props.value === 'string') {
      return { value: props.value, label: props.value };
    }
    return props.value;
  }, [props.value]);


  const handleSelectChange = (selected: SelectValue<any> | null) => {
    props.onChange({
      value: selected.value,
      label: selected.label ?? selected.value,
      description: selected.description,
    });
  };

  const handleCreateOption = (customValue: string) => {
    props.onChange({
      value: customValue as any,
      label: customValue,
    });
  };

  const asyncOption = useCallback((value: SelectValue<any>) => {
    if (typeof props.options === 'function') {
      return props.options(value);
    }
    return Promise.resolve([]);
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

  if (Combobox) {
    return (
      <Combobox {...props} />
    );
  }

  if (typeof selectOptions === 'function') {
    return (
      <AsyncSelect
        placeholder={props.placeholder}
        width={props.width}
        value={normalizedValue}
        loadOptions={selectOptions}
        defaultOptions
        allowCustomValue={props.createCustomValue}
        onCreateOption={props.createCustomValue ? handleCreateOption : undefined}
        onChange={handleSelectChange}
        onBlur={props.onBlur}
        isClearable={props.isClearable}
        isLoading={props.loading}
        disabled={props.disabled}
      />
    );
  }

  return (
    <Select
      placeholder={props.placeholder}
      width={props.width}
      value={normalizedValue}
      options={selectOptions}
      allowCustomValue={props.createCustomValue}
      onCreateOption={props.createCustomValue ? handleCreateOption : undefined}
      onChange={handleSelectChange}
      onBlur={props.onBlur}
      isClearable={props.isClearable}
      isLoading={props.loading}
      disabled={props.disabled}
    />
  );
};
