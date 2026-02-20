import { DataFrame } from '@grafana/data';

import { FrameField } from '../types';

export function getStreamIds(frame: DataFrame) {
  const labelsField = frame.fields.find(f => f.name === FrameField.Labels);
  if (!labelsField) {
    return [];
  }
  return labelsField?.values.map(labels => labels._stream_id);
}
