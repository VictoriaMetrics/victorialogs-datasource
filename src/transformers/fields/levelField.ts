import { DataFrame, Field, FieldType } from '@grafana/data';

import { LogLevelRule } from '../../configuration/LogLevelRules/types';
import { extractLevelFromLabels } from '../../configuration/LogLevelRules/utils';
import { FrameField } from '../types';

export function addLevelField(frame: DataFrame, rules: LogLevelRule[]): DataFrame {
  const rows = frame.length ?? frame.fields[0]?.values.length ?? 0;
  const lineField = frame.fields.find(f => f.name === FrameField.Line);
  const labelsField = frame.fields.find(f => f.name === FrameField.Labels);

  const levelValues = Array.from({ length: rows }, (_, idx) => {
    const labels = (labelsField?.values[idx] ?? {}) as Record<string, string>;
    const msg = lineField?.values[idx] ?? '';
    const labelsWithMsg = { ...labels, _msg: msg };
    return extractLevelFromLabels(labelsWithMsg, rules);
  });

  const levelField: Field = {
    name: FrameField.DetectedLevel,
    type: FieldType.string,
    config: {},
    values: levelValues,
  };

  return { ...frame, fields: [...frame.fields, levelField] };
}
