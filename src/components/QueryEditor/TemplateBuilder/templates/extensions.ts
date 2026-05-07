import { placeholder, text, uniqueId } from '../segmentHelpers';

import { OptionalExtension } from './types';

export const ifExtension: OptionalExtension = {
  key: 'if',
  label: 'if',
  createSegments: () => [
    text(' if ('),
    placeholder(uniqueId('ifFilter'), { role: 'expression', displayHint: 'filter', optionSource: 'freeText' }),
    text(')'),
  ],
};

export const asExtension: OptionalExtension = {
  key: 'as',
  label: 'as',
  createSegments: () => [
    text(' as '),
    placeholder(uniqueId('resultName'), { role: 'expression', displayHint: 'result_name', optionSource: 'freeText' }),
  ],
};

export const byExtension: OptionalExtension = {
  key: 'by',
  label: 'by',
  insertionIndex: 1,
  createSegments: () => [
    text('by ('),
    placeholder(uniqueId('byFields'), { role: 'fieldName', displayHint: 'fields', optionSource: 'fieldNames', multi: true }),
    text(') '),
  ],
};

export const statsExtensions: OptionalExtension[] = [byExtension, ifExtension, asExtension];

export const limitExtension: OptionalExtension = {
  key: 'limit',
  label: 'limit',
  createSegments: () => [
    text(' limit '),
    placeholder(uniqueId('limit'), { role: 'number', displayHint: 'N', optionSource: 'freeText' }),
  ],
};

export const offsetExtension: OptionalExtension = {
  key: 'offset',
  label: 'offset',
  createSegments: () => [
    text(' offset '),
    placeholder(uniqueId('offset'), { role: 'number', displayHint: 'N', optionSource: 'freeText' }),
  ],
};

export const partitionByExtension: OptionalExtension = {
  key: 'partition_by',
  label: 'partition by',
  createSegments: () => [
    text(' partition by ('),
    placeholder(uniqueId('partFields'), { role: 'fieldName', displayHint: 'fields', optionSource: 'fieldNames', multi: true }),
    text(')'),
  ],
};

// Used in pack_json, pack_logfmt (modify) and agg_pack_json (aggregateModify)
export const packExtensions: OptionalExtension[] = [
  {
    key: 'fields',
    label: 'fields',
    createSegments: () => [
      text(' fields ('),
      placeholder(uniqueId('fields'), { role: 'fieldName', displayHint: 'fields', optionSource: 'fieldNames', multi: true }),
      text(')'),
    ],
  },
  {
    key: 'as',
    label: 'as',
    createSegments: () => [
      text(' as '),
      placeholder(uniqueId('result'), { role: 'expression', displayHint: 'result_field', optionSource: 'freeText' }),
    ],
  },
];

// Used in unpack_json, unpack_logfmt (modify)
export const unpackExtensions: OptionalExtension[] = [
  {
    key: 'fields',
    label: 'fields',
    createSegments: () => [
      text(' fields ('),
      placeholder(uniqueId('fields'), { role: 'fieldName', displayHint: 'fields', optionSource: 'fieldNames', multi: true }),
      text(')'),
    ],
  },
  {
    key: 'result_prefix',
    label: 'result_prefix',
    createSegments: () => [
      text(' result_prefix '),
      placeholder(uniqueId('prefix'), { role: 'expression', displayHint: 'prefix', optionSource: 'freeText' }),
    ],
  },
];
