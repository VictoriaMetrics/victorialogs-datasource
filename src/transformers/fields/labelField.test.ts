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

  it('keeps a column as string when only some of its values are numeric', () => {
    const mixed: Field[] = [
      ...fields.slice(0, 2),
      { name: 'labels', type: FieldType.other, config: {}, values: [{ code: '200' }, { code: 'n/a' }] },
    ];

    expect(getStreamFields(mixed, true).find((f) => f.name === 'code')).toMatchObject({
      type: FieldType.string,
      values: ['200', 'n/a'],
    });
  });

  it('keeps only the first of log fields that differ by case', () => {
    const sameCase: Field[] = [
      ...fields.slice(0, 2),
      { name: 'labels', type: FieldType.other, config: {}, values: [{ status: 'ok' }, { STATUS: 'fail' }] },
    ];

    const result = getStreamFields(sameCase, true);

    expect(result.map((f) => f.name)).toEqual(['Time', 'Line', 'labels', 'status']);
    expect(result.find((f) => f.name === 'status')?.values).toEqual(['ok', null]);
  });

  it('skips log fields that collide with existing fields regardless of case', () => {
    const withCollision: Field[] = [
      ...fields.slice(0, 2),
      { name: 'labels', type: FieldType.other, config: {}, values: [{ line: 'a', TIME: 'b' }, {}] },
    ];

    const names = getStreamFields(withCollision, true).map((f) => f.name);

    expect(names).toEqual(['Time', 'Line', 'labels']);
  });

  it('skips log fields named after annotation event fields', () => {
    const withReserved: Field[] = [
      ...fields.slice(0, 2),
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [{ time: 'n/a', TimeEnd: '1', title: 't', text: 'x', tags: 'a,b', ID: '7', level: 'info' }],
      },
    ];

    const names = getStreamFields(withReserved, true).map((f) => f.name);

    expect(names).toEqual(['Time', 'Line', 'labels', 'level']);
  });
});
