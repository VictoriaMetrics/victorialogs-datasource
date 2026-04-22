import { dateTime, TimeRange } from '@grafana/data';

import { FieldHits, FilterFieldType } from '../../types';

import {
  DEFAULT_SEVERITY_FIELD,
  DEFAULT_TRACE_ID_FIELD_SNAKE,
  DETECTION_TIME_WINDOW_MS,
  FIELD_NAMES_SAMPLE_LIMIT,
  SEVERITY_FIELD_CANDIDATES, TRACE_FIELD_CANDIDATES,
} from './constants';
import { OpenTelemetryPresetDetection, SeverityValueCase } from './types';


const DEFAULT_OTEL_PRESET: OpenTelemetryPresetDetection = {
  traceIdField: DEFAULT_TRACE_ID_FIELD_SNAKE,
  severity: {
    field: DEFAULT_SEVERITY_FIELD,
    valueCase: 'number',
    source: 'auto',
  }
};

export interface DetectionBackend {
  languageProvider: {
    getFieldList(options: {
      type: FilterFieldType;
      field?: string;
      limit?: number;
      timeRange?: TimeRange;
    }): Promise<FieldHits[]>;
  };
}

/** Returns a time range that covers the last 24 hours */
function buildDetectionTimeRange(): TimeRange {
  const now = Date.now();
  const to = dateTime(now);
  const from = dateTime(now - DETECTION_TIME_WINDOW_MS);
  return { from, to, raw: { from, to } };
}

export interface RunDetectionOptions {
  /** If provided, skip auto-detection for severity and use this field. */
  severityField?: string;
}

export function detectFieldByCandidate(fieldNames: string[], candidates: string[]) {
  const set = new Set(fieldNames);
  for (const candidate of candidates) {
    if (set.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** detecting the most common value case in a list of values */
export function classifyValueCase(severityField: string): SeverityValueCase {
  if (severityField.toLowerCase().includes('number')){
    return 'number';
  }

  return 'string';
}

export async function runDetection(
  backend: DetectionBackend,
  options: RunDetectionOptions = {},
): Promise<[OpenTelemetryPresetDetection, string[]]> {
  const timeRange = buildDetectionTimeRange();
  const fieldHits = await backend.languageProvider.getFieldList({
    type: FilterFieldType.FieldName,
    limit: FIELD_NAMES_SAMPLE_LIMIT,
    timeRange,
  });
  const fieldNames = fieldHits.map(h => h.value);

  if (fieldNames.length === 0) {
    return [DEFAULT_OTEL_PRESET, fieldNames];
  }

  const traceIdField = detectFieldByCandidate(fieldNames, TRACE_FIELD_CANDIDATES) || DEFAULT_TRACE_ID_FIELD_SNAKE;
  const severityField = options.severityField ?? detectFieldByCandidate(fieldNames, SEVERITY_FIELD_CANDIDATES);
  const severitySource: 'auto' | 'manual' = options.severityField ? 'manual' : 'auto';

  let severity: OpenTelemetryPresetDetection['severity'] | undefined;
  if (severityField) {
    severity = {
      field: severityField,
      valueCase: classifyValueCase(severityField),
      source: severitySource,
    };
  }

  return [{ traceIdField, severity }, fieldNames];
}

