import { Field } from '@grafana/data';

import { FrameField } from '../types';

function transformDashboardLabelField(field: Field): Field {
  if (field.name !== FrameField.Labels) {
    return field;
  }

  return {
    ...field,
    values: field.values.map((value) => {
      return Object.entries(value).map(([key, val]) => {
        return `${key}: ${JSON.stringify(val)}`;
      });
    }),
  };
}

export function getStreamFields(fields: Field[], transformLabels: boolean): Field[] {
  if (!transformLabels) {
    return fields;
  }

  return fields.map(transformDashboardLabelField);
}
