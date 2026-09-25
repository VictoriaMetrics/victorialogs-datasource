import { Field, FieldType } from '@grafana/data';

import { getStreamFields } from './labelField';

const fields: Field[] = [
  { name: 'Time', type: FieldType.time, config: {}, values: [1, 2] },
  { name: 'Line', type: FieldType.string, config: {}, values: ['Cleaning', 'Trip'] },
  {
    name: 'labels',
    type: FieldType.other,
    config: {},
    values: [
      { type: 'range', end: '1790350077332', Line: 'ignored' },
      { type: 'marker', tag: 'Line 1/Speed' },
    ],
  },
];

describe('getStreamFields', () => {
  it('leaves fields untouched outside annotations', () => {
    expect(getStreamFields(fields, false)).toBe(fields);
  });

  it('adds a column per log field for annotations', () => {
    const result = getStreamFields(fields, true);

    expect(result.find((f) => f.name === 'labels')?.values[1]).toEqual(['type: "marker"', 'tag: "Line 1/Speed"']);
    expect(result.find((f) => f.name === 'type')).toMatchObject({
      type: FieldType.string,
      values: ['range', 'marker'],
    });
    expect(result.find((f) => f.name === 'tag')).toMatchObject({
      type: FieldType.string,
      values: [null, 'Line 1/Speed'],
    });
    expect(result.find((f) => f.name === 'end')).toMatchObject({
      type: FieldType.number,
      values: [1790350077332, null],
    });
  });

  it('does not replace existing fields with log fields of the same name', () => {
    const result = getStreamFields(fields, true);

    expect(result.filter((f) => f.name === 'Line')).toHaveLength(1);
    expect(result.find((f) => f.name === 'Line')?.values).toEqual(['Cleaning', 'Trip']);
  });
});
