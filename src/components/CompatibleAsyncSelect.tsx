import React, { useCallback, useMemo } from "react";
import { gte } from "semver";

import { SelectableValue } from "@grafana/data";
import { config } from "@grafana/runtime";
import {
  AsyncSelect,
} from "@grafana/ui";

// Check if we're running Grafana 11+ where Combobox is available
const isGrafana11Plus = gte(config.buildInfo.version, '11.0.0');

// Try to get Combobox dynamically - it only exists in Grafana 11+
let GrafanaCombobox: React.ComponentType<{
  placeholder?: string;
  width?: "auto";
  minWidth?: number;
  value: SelectableValue<string> | null;
  options: (query: string) => Promise<SelectableValue<string>[]>;
  createCustomValue?: boolean;
  onChange: (option: SelectableValue<string> | null) => void;
  isClearable?: boolean;
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

interface CompatibleAsyncSelectProps {
  placeholder?: string;
  minWidth?: number;
  value: SelectableValue<string> | null;
  loadOptions: (inputValue: string) => Promise<SelectableValue<string>[]>;
  onChange: (option: SelectableValue<string> | null) => void;
  isClearable?: boolean;
  allowCustomValue?: boolean;
}

/**
 * A compatibility wrapper for async select that uses Combobox in Grafana 11+
 * and AsyncSelect in older versions.
 */
const CompatibleAsyncSelect: React.FC<CompatibleAsyncSelectProps> = ({
  placeholder,
  minWidth = 15,
  value,
  loadOptions,
  onChange,
  isClearable = false,
  allowCustomValue = false,
}) => {
  // Normalize value to ComboboxOption format
  const normalizedValue = useMemo(() => {
    if (!value) return null;
    return value;
  }, [value]);

  // Adapter for AsyncSelect onChange to convert SelectableValue to ComboboxOption
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
        width="auto"
        minWidth={minWidth}
        value={normalizedValue}
        options={loadOptions}
        createCustomValue={allowCustomValue}
        onChange={onChange}
        isClearable={isClearable}
      />
    );
  }

  return (
    <AsyncSelect
      placeholder={placeholder}
      width="auto"
      value={normalizedValue}
      loadOptions={loadOptions}
      defaultOptions
      allowCustomValue={allowCustomValue}
      onChange={handleSelectChange}
      isClearable={isClearable}
    />
  );
};

export default CompatibleAsyncSelect;
