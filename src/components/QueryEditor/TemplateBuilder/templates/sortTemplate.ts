import { getTabOrder, placeholder, text, uniqueId } from '../segmentHelpers';

import { limitExtension, offsetExtension, partitionByExtension } from './extensions';
import { TemplateConfig } from './types';

export const SORT_TEMPLATE: TemplateConfig = {
  type: 'sort',
  label: 'Sort',
  stepCategory: 'sort',
  createSegments: () => [
    text('sort by ('),
    placeholder(uniqueId('field'), { role: 'fieldName', displayHint: 'field_name', optionSource: 'fieldNames' }),
    text(' '),
    placeholder(uniqueId('dir'), {
      role: 'direction', displayHint: 'direction', optionSource: 'static',
      defaultValue: 'asc',
      staticOptions: [{ label: 'asc', value: 'asc' }, { label: 'desc', value: 'desc' }],
    }),
    text(')'),
  ],
  tabOrder: getTabOrder,
  optionalExtensions: [
    offsetExtension,
    limitExtension,
    partitionByExtension,
    {
      key: 'rank_as',
      label: 'rank as',
      createSegments: () => [
        text(' rank as '),
        placeholder(uniqueId('rankField'), { role: 'text', displayHint: 'field_name', optionSource: 'freeText' }),
      ],
    },
  ],
};
