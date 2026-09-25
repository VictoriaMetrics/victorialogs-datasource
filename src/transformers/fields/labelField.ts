import { Field, FieldType } from '@grafana/data';

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

// Exposes every log field as its own column, so annotation mappings can pick it,
// e.g. a numeric end time (epoch milliseconds) for "Time end", or a single field for "Title" or "Tags".
function getLogFieldColumns(fields: Field[]): Field[] {
  const labels = fields.find((f) => f.name === FrameField.Labels);
  if (!labels) {
    return [];
  }

  const existing = new Set(fields.map((f) => f.name));
  const keys = new Set<string>(labels.values.flatMap((value) => Object.keys(value ?? {})));

  return [...keys]
    .filter((key) => !existing.has(key))
    .map((key) => {
      const values = labels.values.map((value) => value?.[key] ?? null);
      const isNumber = values.every((v) => v === null || (v !== '' && Number.isFinite(Number(v))));
      return {
        name: key,
        type: isNumber ? FieldType.number : FieldType.string,
        config: {},
        values: isNumber ? values.map((v) => (v === null ? null : Number(v))) : values,
      };
    });
}

export function getStreamFields(fields: Field[], transformLabels: boolean): Field[] {
  if (!transformLabels) {
    return fields;
  }

  return [...fields.map(transformDashboardLabelField), ...getLogFieldColumns(fields)];
}
