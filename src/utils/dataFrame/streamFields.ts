import { DataFrame, Field } from '@grafana/data';

import { FrameField } from '../../transformers/types';

/** Returns the hidden per-row stream fields data of a logs frame */
export function getFrameStreamsField(frame: DataFrame): Field | undefined {
  return frame.fields.find((f) => f.name === FrameField.Streams);
}

// Per-row stream label map from the hidden `streams` field attached by the
// backend to every logs frame (see pkg/plugin/response_logs.go); a row
// without a `_stream` field is null
type StreamMap = Record<string, string> | null;

/** Returns true when the key is a stream field, i.e. present in at least one per-row map of the frame's hidden `streams` field */
export function frameHasStreamField(frame: DataFrame | undefined, key: string): boolean {
  if (!frame) {
    return false;
  }
  const streamsField = getFrameStreamsField(frame);
  if (!streamsField) {
    return false;
  }
  return streamsField.values.some((labels: StreamMap) => labels != null && key in labels);
}
