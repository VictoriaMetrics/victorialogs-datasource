export type SeverityValueCase = 'string' | 'number';
export type SeveritySource = 'auto' | 'manual';

export interface OpenTelemetryPresetSeverity {
  field: string;
  valueCase: SeverityValueCase;
  source: SeveritySource;
}

export interface OpenTelemetryPresetDetection {
  traceIdField: string;
  severity?: OpenTelemetryPresetSeverity;
}

export interface OpenTelemetryPreset {
  enabled: boolean;
  tracesDatasourceUid?: string;
  detection?: OpenTelemetryPresetDetection;
}
