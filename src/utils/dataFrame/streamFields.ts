import { DataFrame, Field } from '@grafana/data';

import { FrameField } from '../../transformers/types';

/** Returns the hidden per-row stream fields data of a logs frame */
export function getFrameStreamsField(frame: DataFrame): Field | undefined {
  return frame.fields.find((f) => f.name === FrameField.Streams);
}
