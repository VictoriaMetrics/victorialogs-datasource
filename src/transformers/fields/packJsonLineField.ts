import { DataFrame } from '@grafana/data';

import { Query, QueryType } from '../../types';
import { FrameField } from '../types';

const MSG_KEY = '_msg';

/**
 * Tells whether log labels should be packed into the `Line` field for the given query.
 * Applied only to plain raw logs queries with the `Pack to JSON` option enabled —
 * stats, hits (logs volume) and supporting queries (logs sample) are left untouched
 */
export function shouldPackLabelsToLine(query: Query | undefined): boolean {
  return Boolean(
    query?.packJson && query.queryType === QueryType.Instant && !query.supportingQueryType
  );
}

/**
 * Replaces the `Line` field values with a JSON object of all log labels, so the log viewer
 * shows all labels as the log line even when the `_msg` field is missing. The original
 * message (if any) is kept in the JSON under the `_msg` key. The `labels` field itself
 * is left untouched, so filtering by labels keeps working
 */
export function packLabelsToLine(frame: DataFrame): DataFrame {
  const lineField = frame.fields.find((f) => f.name === FrameField.Line);
  const labelsField = frame.fields.find((f) => f.name === FrameField.Labels);

  if (!lineField || !labelsField) {
    return frame;
  }

  const packedValues = lineField.values.map((line, i) => {
    const labels = (labelsField.values[i] ?? {}) as Record<string, unknown>;
    if (!line && Object.keys(labels).length === 0) {
      return line;
    }
    return JSON.stringify(line ? { [MSG_KEY]: line, ...labels } : labels);
  });

  return {
    ...frame,
    fields: frame.fields.map((field) =>
      field === lineField ? { ...field, values: packedValues } : field
    ),
  };
}
