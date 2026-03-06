import { getTabOrder, placeholder, text, uniqueId } from '../segmentHelpers';

import { partitionByExtension } from './extensions';
import { TemplateConfig } from './types';

const countWithFieldsTemplate = (type: string, label: string): TemplateConfig => ({
  type,
  label,
  stepCategory: 'limit',
  createSegments: () => [
    text(`${type} `),
    placeholder(uniqueId('count'), { role: 'number', displayHint: 'N', optionSource: 'freeText' }),
    text(' by ('),
    placeholder(uniqueId('fields'), { role: 'fieldName', displayHint: 'fields', optionSource: 'fieldNames', multi: true }),
    text(')'),
  ],
  tabOrder: getTabOrder,
  optionalExtensions: [partitionByExtension],
});

export const LIMIT_TEMPLATES: TemplateConfig[] = [
  {
    type: 'limit',
    label: 'Limit',
    stepCategory: 'limit',
    createSegments: () => [
      text('limit '),
      placeholder(uniqueId('count'), { role: 'number', displayHint: 'N', optionSource: 'freeText' }),
    ],
    tabOrder: getTabOrder,
  },
  {
    type: 'offset',
    label: 'Offset',
    stepCategory: 'limit',
    createSegments: () => [
      text('offset '),
      placeholder(uniqueId('count'), { role: 'number', displayHint: 'N', optionSource: 'freeText' }),
    ],
    tabOrder: getTabOrder,
  },
  countWithFieldsTemplate('first', 'First'),
  countWithFieldsTemplate('last', 'Last'),
  countWithFieldsTemplate('top', 'Top'),
];
