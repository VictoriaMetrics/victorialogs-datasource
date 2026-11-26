import { SelectableValue } from '@grafana/data';

import { ExportFormat } from './types';

/** The backend resource that streams the file; see `VLExportLogs` in pkg/plugin/export.go */
export const EXPORT_LOGS_RESOURCE = 'export/logs';

/** The ID of the CSV requirement; see `Requirements` in pkg/vlcompat/requirements.go */
export const CSV_EXPORT_REQUIREMENT_ID = 'csvExport';

export const DEFAULT_EXPORT_FORMAT: ExportFormat = 'jsonl';

export const FORMAT_OPTIONS: Array<SelectableValue<ExportFormat>> = [
  { label: 'JSON Lines', value: 'jsonl' },
  { label: 'CSV', value: 'csv' },
];
