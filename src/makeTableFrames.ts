import { groupBy } from "lodash";

import { DataFrame, Field, FieldType } from "@grafana/data";

export function makeTableFrames(instantMetricFrames: DataFrame[]): DataFrame[] {
  // first we remove frames that have no refId
  // (we will group them by refId, so we need it to be set)
  const framesWithRefId = instantMetricFrames.filter((f) => f.refId !== undefined);

  const framesByRefId = groupBy(framesWithRefId, (frame) => frame.refId);

  return Object.entries(framesByRefId).map(([refId, frames]) => makeTableFrame(frames, refId));
}

function makeTableFrame(instantMetricFrames: DataFrame[], refId: string): DataFrame {
  const tableTimeField: Field = { name: 'Time', config: {}, values: [], type: FieldType.time };
  const tableValueField: Field = {
    name: `Value #${refId}`,
    config: {},
    values: [],
    type: FieldType.number,
  };

  // Sort metric labels, create columns for them and record their index
  const allLabelNames = new Set(
    instantMetricFrames.map((frame) => frame.fields.map((field) => Object.keys(field.labels ?? {})).flat()).flat()
  );

  const sortedLabelNames = Array.from(allLabelNames).sort();

  const labelFields: Field[] = sortedLabelNames.map((labelName) => ({
    name: labelName,
    config: { filterable: true },
    values: [],
    type: FieldType.string,
  }));

  instantMetricFrames.forEach((frame) => {
    const timeField = frame.fields.find((field) => field.type === FieldType.time);
    const valueField = frame.fields.find((field) => field.type === FieldType.number);
    if (timeField == null || valueField == null) {
      return;
    }

    const timeArray = timeField.values;
    const valueArray = valueField.values;

    for (const x of timeArray) {
      tableTimeField.values.push(x);
    }

    for (const x of valueArray) {
      tableValueField.values.push(x);
    }

    const labels = valueField.labels ?? {};

    for (const f of labelFields) {
      const text = labels[f.name] ?? '';
      // we insert the labels as many times as we have values
      for (let i = 0; i < valueArray.length; i++) {
        f.values.push(text);
      }
    }
  });

  return {
    fields: [tableTimeField, ...labelFields, tableValueField],
    refId,
    meta: { preferredVisualisationType: 'table' },
    length: tableTimeField.values.length,
  };
}
