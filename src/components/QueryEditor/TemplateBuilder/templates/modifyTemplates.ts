import { getTabOrder, placeholder, text, uniqueId } from '../segmentHelpers';

import { limitExtension, packExtensions, unpackExtensions } from './extensions';
import { TemplateConfig } from './types';

const fieldPairTemplate = (keyword: string): TemplateConfig => ({
  type: keyword,
  label: keyword.charAt(0).toUpperCase() + keyword.slice(1),
  stepCategory: 'modify',
  group: 'Fields',
  createSegments: () => [
    text(`${keyword} `),
    placeholder(uniqueId('src'), { role: 'fieldName', displayHint: 'source_field', optionSource: 'fieldNames' }),
    text(' as '),
    placeholder(uniqueId('dst'), { role: 'expression', displayHint: 'new_name', optionSource: 'freeText' }),
  ],
  tabOrder: getTabOrder,
});

const fieldListTemplate = (keyword: string, label: string, description?: string): TemplateConfig => ({
  type: keyword,
  label,
  description,
  stepCategory: 'modify',
  group: 'Fields',
  createSegments: () => [
    text(`${keyword} `),
    placeholder(uniqueId('fields'), { role: 'fieldName', displayHint: 'fields', optionSource: 'fieldNames', multi: true }),
  ],
  tabOrder: getTabOrder,
});

export const MODIFY_TEMPLATES: TemplateConfig[] = [
  fieldPairTemplate('rename'),
  fieldPairTemplate('copy'),
  fieldListTemplate('delete', 'Delete', 'Remove fields'),
  fieldListTemplate('keep', 'Keep', 'Keep only specified fields'),
  {
    type: 'replace',
    label: 'Replace',
    description: 'Replace string in field',
    stepCategory: 'modify',
    group: 'Transform',
    createSegments: () => [
      text('replace ("'),
      placeholder(uniqueId('old'), { role: 'text', displayHint: 'old_value', optionSource: 'freeText' }),
      text('", "'),
      placeholder(uniqueId('new'), { role: 'text', displayHint: 'new_value', optionSource: 'freeText' }),
      text('") at '),
      placeholder(uniqueId('field'), { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
    ],
    tabOrder: getTabOrder,
    optionalExtensions: [limitExtension],
  },
  {
    type: 'replace_regexp',
    label: 'Replace Regexp',
    description: 'Replace with regex',
    stepCategory: 'modify',
    group: 'Transform',
    createSegments: () => [
      text('replace_regexp ("'),
      placeholder(uniqueId('pattern'), { role: 'pattern', displayHint: 'pattern', optionSource: 'freeText' }),
      text('", "'),
      placeholder(uniqueId('replacement'), { role: 'text', displayHint: 'replacement', optionSource: 'freeText' }),
      text('") at '),
      placeholder(uniqueId('field'), { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
    ],
    tabOrder: getTabOrder,
    optionalExtensions: [limitExtension],
  },
  {
    type: 'extract',
    label: 'Extract',
    description: 'Extract fields with pattern',
    stepCategory: 'modify',
    group: 'Extract',
    createSegments: () => [
      text('extract "'),
      placeholder(uniqueId('pattern'), { role: 'pattern', displayHint: 'pattern', optionSource: 'freeText' }),
      text('" from '),
      placeholder(uniqueId('field'), { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
    ],
    tabOrder: getTabOrder,
  },
  {
    type: 'extract_regexp',
    label: 'Extract Regexp',
    description: 'Extract with regex',
    stepCategory: 'modify',
    group: 'Extract',
    createSegments: () => [
      text('extract_regexp "'),
      placeholder(uniqueId('pattern'), { role: 'pattern', displayHint: 'pattern', optionSource: 'freeText' }),
      text('" from '),
      placeholder(uniqueId('field'), { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
    ],
    tabOrder: getTabOrder,
  },
  {
    type: 'format',
    label: 'Format',
    description: 'Create field from format string',
    stepCategory: 'modify',
    group: 'Transform',
    createSegments: () => [
      text('format "'),
      placeholder(uniqueId('fmt'), { role: 'expression', displayHint: 'format_string', optionSource: 'freeText' }),
      text('" as '),
      placeholder(uniqueId('result'), { role: 'expression', displayHint: 'result_field', optionSource: 'freeText' }),
    ],
    tabOrder: getTabOrder,
  },
  {
    type: 'pack_json',
    label: 'Pack JSON',
    stepCategory: 'modify',
    group: 'Pack/Unpack',
    createSegments: () => [text('pack_json')],
    tabOrder: () => [],
    optionalExtensions: packExtensions,
  },
  {
    type: 'pack_logfmt',
    label: 'Pack Logfmt',
    stepCategory: 'modify',
    group: 'Pack/Unpack',
    createSegments: () => [text('pack_logfmt')],
    tabOrder: () => [],
    optionalExtensions: packExtensions,
  },
  {
    type: 'unpack_json',
    label: 'Unpack JSON',
    stepCategory: 'modify',
    group: 'Pack/Unpack',
    createSegments: () => [
      text('unpack_json from '),
      placeholder(uniqueId('field'), { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
    ],
    tabOrder: getTabOrder,
    optionalExtensions: unpackExtensions,
  },
  {
    type: 'unpack_logfmt',
    label: 'Unpack Logfmt',
    stepCategory: 'modify',
    group: 'Pack/Unpack',
    createSegments: () => [
      text('unpack_logfmt from '),
      placeholder(uniqueId('field'), { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
    ],
    tabOrder: getTabOrder,
    optionalExtensions: unpackExtensions,
  },
  {
    type: 'drop_empty_fields',
    label: 'Drop Empty Fields',
    stepCategory: 'modify',
    group: 'Fields',
    createSegments: () => [text('drop_empty_fields')],
    tabOrder: () => [],
  },
];
