import React, { useCallback, useMemo } from "react";
import { gte } from "semver";

import { SelectableValue } from "@grafana/data";
import { config } from "@grafana/runtime";
import { Select } from "@grafana/ui";

// Check if we're running Grafana 11+ where Combobox is available
const isGrafana11Plus = gte(config.buildInfo.version, '11.0.0');

// Try to get Combobox dynamically - it only exists in Grafana 11+
let GrafanaCombobox: React.ComponentType<{
  placeholder?: string;
  width?: number | "auto";
  minWidth?: number;
  value: SelectableValue<string> | null;
  options: SelectableValue<string>[];
  createCustomValue?: boolean;
  onChange: (option: SelectableValue<string> | null) => void;
  isClearable?: boolean;
  disabled?: boolean;
}> | null = null;

// Only try to load Combobox if we're on Grafana 11+
if (isGrafana11Plus) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ui = require("@grafana/ui");
    if (ui.Combobox && typeof ui.Combobox === 'function') {
      GrafanaCombobox = ui.Combobox;
    }
  } catch {
    // Combobox not available
  }
}

interface CompatibleSelectProps {
  placeholder?: string;
  minWidth?: number;
  value: SelectableValue<string> | string | null;
  options: SelectableValue<string>[];
  onChange: (option: SelectableValue<string> | null) => void;
  isClearable?: boolean;
  allowCustomValue?: boolean;
  loading?: boolean;
  disabled?: boolean;
  width?: number | "auto";
}

/**
 * A compatibility wrapper for static select that uses Combobox in Grafana 11+
 * and Select in older versions.
 */
export const CompatibleSelect: React.FC<CompatibleSelectProps> = ({
  placeholder,
  minWidth = 15,
  value,
  options,
  onChange,
  isClearable = false,
  allowCustomValue = false,
  loading = false,
  disabled = false,
  width = "auto",
}) => {
  // Normalize value to ComboboxOption format
  const normalizedValue = useMemo(() => {
    if (!value) return null;
    if (typeof value === 'string') {
      return { value, label: value };
    }
    return value;
  }, [value]);

  // Adapter for Select onChange to convert SelectableValue to ComboboxOption
  const handleSelectChange = useCallback(
    (selected: SelectableValue<string> | null) => {
      if (!selected || !selected.value) {
        onChange(null);
        return;
      }
      onChange({
        value: selected.value,
        label: selected.label ?? selected.value,
        description: selected.description,
      });
    },
    [onChange]
  );

  if (GrafanaCombobox) {
    return (
      <GrafanaCombobox
        placeholder={placeholder}
        width={width}
        minWidth={minWidth}
        value={normalizedValue}
        options={options}
        createCustomValue={allowCustomValue}
        onChange={onChange}
        isClearable={isClearable}
        disabled={disabled}
      />
    );
  }

  return (
    <Select
      placeholder={placeholder}
      width={width}
      value={normalizedValue}
      options={options}
      allowCustomValue={allowCustomValue}
      onChange={handleSelectChange}
      isClearable={isClearable}
      isLoading={loading}
      disabled={disabled}
    />
  );
};
