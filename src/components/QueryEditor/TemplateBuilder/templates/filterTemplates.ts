import { getTabOrder, placeholder, text, uniqueId } from '../segmentHelpers';

import { TemplateConfig } from './types';

export const STREAM_TEMPLATE: TemplateConfig = {
  type: 'stream',
  label: 'Stream',
  description: 'Exact match on stream label values',
  stepCategory: 'stream',
  createSegments: () => {
    const fieldId = uniqueId('streamFieldName');
    const valuesId = uniqueId('streamValues');
    return [
      placeholder(fieldId, { role: 'streamFieldName', displayHint: 'stream_field', optionSource: 'streamFieldNames' }),
      text(' in('),
      placeholder(valuesId, { role: 'streamFieldValue', displayHint: 'values', optionSource: 'streamFieldValues', multi: true, dependsOn: fieldId }),
      text(')'),
    ];
  },
  tabOrder: getTabOrder,
};

export const FILTER_TEMPLATES: TemplateConfig[] = [
  {
    type: 'exact',
    label: 'Exact',
    description: 'Exact match on stream and non stream field values',
    stepCategory: 'filter',
    createSegments: () => {
      const fieldId = uniqueId('fieldName');
      const valuesId = uniqueId('values');
      return [
        placeholder(fieldId, { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNamesWithStream', excludeOptions: ['_stream', '_msg', '_time'] }),
        text(':in('),
        placeholder(valuesId, { role: 'fieldValue', displayHint: 'values', optionSource: 'fieldValues', multi: true, dependsOn: fieldId }),
        text(')'),
      ];
    },
    tabOrder: getTabOrder,
  },
  {
    type: 'phrase',
    label: 'Phrase',
    description: 'Substring match',
    stepCategory: 'filter',
    createSegments: () => {
      const fieldId = uniqueId('fieldName');
      const valueId = uniqueId('value');
      return [
        placeholder(fieldId, { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames', excludeOptions: ['_stream'] }),
        text(':'),
        placeholder(valueId, { role: 'fieldValue', displayHint: 'value', optionSource: 'freeText' }),
      ];
    },
    tabOrder: getTabOrder,
  },
  {
    type: 'range',
    label: 'Range',
    description: 'Numeric comparison',
    stepCategory: 'filter',
    createSegments: () => {
      const fieldId = uniqueId('fieldName');
      return [
        placeholder(fieldId, { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
        text(':'),
        placeholder(uniqueId('op'), {
          role: 'operator', displayHint: 'op', optionSource: 'static',
          defaultValue: '>',
          staticOptions: [
            { label: '>', value: '>' }, { label: '>=', value: '>=' },
            { label: '<', value: '<' }, { label: '<=', value: '<=' },
          ],
        }),
        placeholder(uniqueId('value'), { role: 'number', displayHint: 'number', optionSource: 'freeText' }),
      ];
    },
    tabOrder: getTabOrder,
  },
  {
    type: 'regexp',
    label: 'Regexp',
    description: 'Regular expression match',
    stepCategory: 'filter',
    createSegments: () => {
      const fieldId = uniqueId('fieldName');
      return [
        placeholder(fieldId, { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
        text(':'),
        placeholder(uniqueId('op'), {
          role: 'operator', displayHint: 'op', optionSource: 'static',
          defaultValue: '~',
          staticOptions: [{ label: '~', value: '~' }, { label: '!~', value: '!~' }],
        }),
        text('"'),
        placeholder(uniqueId('pattern'), { role: 'pattern', displayHint: 'pattern', optionSource: 'freeText' }),
        text('"'),
      ];
    },
    tabOrder: getTabOrder,
  },
  {
    type: 'caseInsensitive',
    label: 'Case Insensitive',
    description: 'Case-insensitive match',
    stepCategory: 'filter',
    createSegments: () => {
      const fieldId = uniqueId('fieldName');
      return [
        placeholder(fieldId, { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
        text(':'),
        placeholder(uniqueId('op'), {
          role: 'operator', displayHint: 'op', optionSource: 'static',
          defaultValue: 'i',
          staticOptions: [{ label: 'i', value: 'i' }, { label: '!i', value: '!i' }],
        }),
        text('('),
        placeholder(uniqueId('value'), { role: 'fieldValue', displayHint: 'value', optionSource: 'fieldValues', dependsOn: fieldId }),
        text(')'),
      ];
    },
    tabOrder: getTabOrder,
  },
];
