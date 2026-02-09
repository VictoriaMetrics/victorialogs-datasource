import React from "react";

import { InlineField, InlineSwitch } from "@grafana/ui";

import { PropsConfigEditor } from "./ConfigEditor";

export function AlertingSettings({ options, onOptionsChange }: PropsConfigEditor) {
  return (
    <div>
      <InlineField
        labelWidth={29}
        label="Manage alert rules in Alerting UI"
        disabled={options.readOnly}
        tooltip="Manage alert rules for this data source. To manage other alerting resources, add an Alertmanager data source."
      >
        <InlineSwitch
          value={options.jsonData.manageAlerts !== false}
          onChange={(event) =>
            onOptionsChange({
              ...options,
              jsonData: { ...options.jsonData, manageAlerts: event!.currentTarget.checked },
            })
          }
        />
      </InlineField>
    </div>
  );
}
